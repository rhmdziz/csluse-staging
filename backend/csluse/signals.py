from datetime import timedelta
import sys

from django.db.models.signals import m2m_changed, post_delete, pre_save
from django.dispatch import receiver
from django.core.exceptions import ValidationError
from django.utils import timezone

from csluse_auth.models import Profile
from csluse_auth.permissions import (
    ADMINISTRATOR,
    SUPER_ADMINISTRATOR,
    has_role,
)

from .models import Image, Booking, BookingEquipmentItem, Borrow, Room, Pengujian

def is_loaddata():
    return 'loaddata' in sys.argv


def should_skip_signal(kwargs):
    return kwargs.get("raw", False) or is_loaddata()


def validate_start_not_in_past(start_time, label="start time"):
    if not start_time:
        return

    current_time = timezone.now()
    if start_time <= current_time:
        raise ValidationError(
            f"Cannot create or update data with a {label} in the past."
        )


def validate_booking_working_hours(start_time, end_time):
    if not start_time or not end_time:
        return

    local_start = timezone.localtime(start_time)
    local_end = timezone.localtime(end_time)

    start_minutes = (local_start.hour * 60) + local_start.minute
    end_minutes = (local_end.hour * 60) + local_end.minute
    workday_start = 8 * 60
    workday_end = 17 * 60

    if start_minutes < workday_start or start_minutes > workday_end:
        raise ValidationError(
            "Booking start time must be within working hours (08:00-17:00 WIB)."
        )

    if end_minutes < workday_start or end_minutes > workday_end:
        raise ValidationError(
            "Booking end time must be within working hours (08:00-17:00 WIB)."
        )

    if local_end <= local_start:
        raise ValidationError("Booking end time must be after start time.")


def validate_no_weekend_range(start_time, end_time=None, label="time range"):
    if not start_time:
        return

    local_start = timezone.localtime(start_time)
    local_end = timezone.localtime(end_time) if end_time else local_start

    if local_end < local_start:
        return

    current_day = local_start.date()
    last_day = local_end.date()

    while current_day <= last_day:
        if current_day.weekday() >= 5:
            raise ValidationError(
                f"{label.capitalize()} cannot be on or pass through Saturday or Sunday."
            )
        current_day = current_day + timedelta(days=1)


def is_admin_approver(profile):
    if not profile:
        return False

    approver_role = str(profile.role or "").upper()
    approver_user = getattr(profile, "user", None)

    return (
        approver_role == "ADMIN"
        or getattr(approver_user, "is_superuser", False)
        or has_role(approver_user, ADMINISTRATOR)
        or has_role(approver_user, SUPER_ADMINISTRATOR)
    )


@receiver(post_delete, sender=Image)
def delete_image(sender, instance, **kwargs):
    image_name = instance.image.name
    if image_name:
        instance.image.storage.delete(image_name)


@receiver(pre_save, sender=Booking)
def validate_booking(sender, instance, **kwargs):
    if should_skip_signal(kwargs):
        return

    previous_instance = None
    if instance.pk:
        previous_instance = Booking.objects.filter(pk=instance.pk).only(
            "start_time",
            "end_time",
            "status",
        ).first()

    start_time_changed = (
        previous_instance is None
        or previous_instance.start_time != instance.start_time
    )

    # Only validate past booking starts on create or when the requested time is changed.
    if start_time_changed:
        validate_start_not_in_past(instance.start_time, "booking start time")

    validate_booking_working_hours(instance.start_time, instance.end_time)

    # approved_by must be room PIC or Admin (when set)
    if instance.approved_by_id:
        if not is_admin_approver(instance.approved_by):
            if not instance.room.pics.filter(id=instance.approved_by_id).exists():
                raise ValidationError(
                    "Approver harus PIC ruangan terkait atau Admin."
                )


@receiver(pre_save, sender=BookingEquipmentItem)
def validate_booking_equipment_item(sender, instance, **kwargs):
    if should_skip_signal(kwargs):
        return

    if instance.quantity <= 0:
        raise ValidationError("Quantity equipment must be at least 1.")

    if instance.equipment.room_id != instance.booking.room_id:
        raise ValidationError(
            f"{instance.equipment.name} harus berasal dari ruangan {instance.booking.room.name}."
        )

    if instance.quantity > instance.equipment.quantity:
        raise ValidationError(
            f"Quantity {instance.quantity} melebihi stok {instance.equipment.quantity} untuk {instance.equipment.name}."
        )


@receiver(pre_save, sender=Borrow)
def validate_borrow(sender, instance, **kwargs):
    if should_skip_signal(kwargs):
        return

    """
    Borrow rules:
    - Quantity > 0 and <= equipment stock.
    - Start time cannot be moved into the past.
    """
    previous_instance = None
    if instance.pk:
        previous_instance = Borrow.objects.filter(pk=instance.pk).only(
            "start_time",
        ).first()

    # quantity checks (apply to create/update)
    if instance.quantity <= 0:
        raise ValidationError("Borrow quantity must be at least 1.")

    start_time_changed = (
        previous_instance is None
        or previous_instance.start_time != instance.start_time
    )
    if start_time_changed:
        validate_start_not_in_past(instance.start_time, "borrow start time")

    if instance.equipment_id:
        equipment_qty = instance.equipment.quantity
        if instance.quantity > equipment_qty:
            raise ValidationError(
                f"Requested quantity ({instance.quantity}) exceeds equipment stock ({equipment_qty})."
            )

        if not instance.equipment.is_moveable:
            raise ValidationError("Only moveable equipment can be borrowed.")

    # approved_by must be equipment room PIC or Admin (when set)
    if instance.approved_by_id:
        if not is_admin_approver(instance.approved_by):
            room = instance.equipment.room if instance.equipment_id else None
            if not room or not room.pics.filter(id=instance.approved_by_id).exists():
                raise ValidationError(
                    "Approver harus PIC ruangan dari equipment terkait atau Admin."
                )


def validate_room_pics(profiles):
    allowed_roles = {"LECTURER", "ADMIN"}
    for profile in profiles:
        pic_role = str(profile.role or "").upper()
        if pic_role not in allowed_roles:
            raise ValidationError(
                "PIC harus user dengan role Lecturer atau Admin."
            )


@receiver(m2m_changed, sender=Room.pics.through)
def validate_room_pic_members(sender, instance, action, pk_set, **kwargs):
    if should_skip_signal(kwargs):
        return

    """
    Ensure every Room PIC has an allowed role.
    """
    if action != "pre_add" or not pk_set:
        return

    profiles = Profile.objects.filter(pk__in=pk_set)
    validate_room_pics(profiles)


@receiver(pre_save, sender=Pengujian)
def validate_pengujians(sender, instance, **kwargs):
    if should_skip_signal(kwargs):
        return

    """
    Pengujian rules:
    - Rejected/completed requests are locked.
    - approved_by must be Admin (when set).
    """
    previous_instance = None
    if instance.pk:
        previous_instance = Pengujian.objects.filter(pk=instance.pk).only(
            "status",
            "approved_by_id",
        ).first()

    if previous_instance and previous_instance.status in {"Rejected", "Completed"}:
        raise ValidationError("Pengujian yang sudah selesai diproses tidak dapat diubah.")

    if (
        instance.approved_by_id
        and not is_admin_approver(instance.approved_by)
        and (
            previous_instance is None
            or previous_instance.approved_by_id != instance.approved_by_id
        )
    ):
        raise ValidationError("Approver harus Admin.")
