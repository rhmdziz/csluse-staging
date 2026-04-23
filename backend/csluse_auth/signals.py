import sys

from django.contrib.auth import get_user_model
from django.db.models.signals import m2m_changed, post_save
from django.dispatch import receiver

from .models import Profile
from .permissions import (
    ADMINISTRATOR,
    ALL_ROLES,
    GUEST,
    LECTURER,
    STAFF,
    STUDENT,
    SUPER_ADMINISTRATOR,
    assign_role,
)

User = get_user_model()


PROFILE_TO_GROUP_ROLE_MAP = {
    "ADMIN": ADMINISTRATOR,
    "LECTURER": LECTURER,
    "STUDENT": STUDENT,
    "STAFF": STAFF,
    "GUEST": GUEST,
    "OTHER": GUEST,
}

GROUP_TO_PROFILE_ROLE_MAP = {
    STUDENT: "Student",
    LECTURER: "Lecturer",
    STAFF: "Staff",
    ADMINISTRATOR: "Admin",
    SUPER_ADMINISTRATOR: "Admin",
    GUEST: "Guest",
}

GROUP_NAME_NORMALIZATION_MAP = {
    "student": STUDENT,
    "lecturer": LECTURER,
    "staff": STAFF,
    "administrator": ADMINISTRATOR,
    "admin": ADMINISTRATOR,
    "superadministrator": SUPER_ADMINISTRATOR,
    "super_administrator": SUPER_ADMINISTRATOR,
    "super-administrator": SUPER_ADMINISTRATOR,
    "super administrator": SUPER_ADMINISTRATOR,
    "guest": GUEST,
    "other": GUEST,
}


def _pick_user_group_role(user):
    normalized_roles = set()
    for raw_name in user.groups.values_list("name", flat=True):
        key = str(raw_name or "").strip().lower()
        role = GROUP_NAME_NORMALIZATION_MAP.get(key)
        if role:
            normalized_roles.add(role)

    for role_name in [SUPER_ADMINISTRATOR, ADMINISTRATOR, STAFF, LECTURER, STUDENT, GUEST]:
        if role_name in normalized_roles:
            return role_name
    return None


@receiver(post_save, sender=User)
def create_profile_for_new_user(sender, instance, created, **kwargs):
    if not created or "loaddata" in sys.argv:
        return

    email = str(getattr(instance, "email", "") or "").strip().lower()
    full_name = f"{instance.first_name} {instance.last_name}".strip()

    profile = None
    if email:
        profile = (
            Profile.objects.filter(user__isnull=True, email__iexact=email)
            .order_by("created_at")
            .first()
        )

    if profile is not None:
        profile.user = instance
        if full_name and not profile.full_name:
            profile.full_name = full_name
        if not profile.email:
            profile.email = email
        profile.save()
        return

    profile, profile_created = Profile.objects.get_or_create(
        user=instance,
        defaults={
            "email": email,
            **({"full_name": full_name} if full_name else {}),
            "user_type": "External",
        },
    )

    updated_fields = []
    if email and profile.email != email:
        profile.email = email
        updated_fields.append("email")
    if not profile_created and not profile.full_name and full_name:
        profile.full_name = full_name
        updated_fields.append("full_name")
    if updated_fields:
        profile.save(update_fields=updated_fields)


@receiver(post_save, sender=Profile)
def sync_profile_role_to_group(sender, instance, **kwargs):
    """Keep Django auth groups in sync with Profile.role."""
    if instance.user is None:
        return

    role_value = instance.role
    if not role_value:
        # If role is cleared, remove role groups to keep both sources consistent.
        for existing_role in ALL_ROLES:
            instance.user.groups.remove(*instance.user.groups.filter(name=existing_role))
        return

    group_name = PROFILE_TO_GROUP_ROLE_MAP.get(str(role_value).upper())
    if not group_name or group_name not in ALL_ROLES:
        return

    assign_role(instance.user, group_name)


@receiver(m2m_changed, sender=User.groups.through)
def sync_group_to_profile_role(sender, instance, action, **kwargs):
    """Keep Profile.role in sync when Django auth groups are edited directly."""
    if action not in {"post_add", "post_remove", "post_clear"} or "loaddata" in sys.argv:
        return

    profile, _ = Profile.objects.get_or_create(
        user=instance,
        defaults={
            "email": str(getattr(instance, "email", "") or "").strip().lower(),
            "user_type": "External",
        },
    )
    if getattr(instance, "email", None):
        next_email = str(instance.email).strip().lower()
        if profile.email != next_email:
            Profile.objects.filter(pk=profile.pk).update(email=next_email)
            profile.email = next_email

    selected_group_role = _pick_user_group_role(instance)

    next_profile_role = GROUP_TO_PROFILE_ROLE_MAP.get(selected_group_role)
    if profile.role == next_profile_role:
        return

    # Use queryset update to avoid re-triggering Profile post_save signal.
    Profile.objects.filter(pk=profile.pk).update(role=next_profile_role)
