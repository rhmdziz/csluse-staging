import re
import secrets
import string

from allauth.account.models import EmailAddress
from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.auth import get_user_model
from dj_rest_auth.registration.serializers import RegisterSerializer
from dj_rest_auth.serializers import LoginSerializer as BaseLoginSerializer
from rest_framework import serializers

from .adapters import is_campus_email, normalize_email
from .audit import log_admin_action
from .models import Department, Profile


User = get_user_model()

ADMIN_ROLE_GROUPS = {"Administrator", "SuperAdministrator"}
ROLE_NORMALIZATION_MAP = {
    "STUDENT": "Student",
    "LECTURER": "Lecturer",
    "ADMIN": "Admin",
    "STAFF": "Staff",
    "GUEST": "Guest",
    "OTHER": "Guest",
}
ROLE_WITH_DEPARTMENT = {"Student", "Lecturer", "Admin"}
ROLE_WITH_BATCH = {"Student"}
ROLE_WITH_ID_NUMBER = {"Student", "Lecturer", "Staff", "Admin"}
USER_TYPE_NORMALIZATION_MAP = {
    "INTERNAL": "Internal",
    "EXTERNAL": "External",
}
BATCH_MIN_YEAR = 2000
BATCH_MAX_YEAR = 2100


def _resolve_department_name(value):
    if value in (None, ""):
        return None if value == "" else value

    normalized = re.sub(r"\s+", " ", str(value or "")).strip()
    department = Department.objects.filter(name__iexact=normalized).first()
    if department is None:
        raise serializers.ValidationError("Department harus sesuai dengan opsi yang tersedia.")
    return department.name


def _validate_batch_year(value):
    if value in (None, ""):
        return None if value == "" else value

    normalized = str(value).strip()
    if not re.fullmatch(r"\d{4}", normalized):
        raise serializers.ValidationError("Batch harus berupa tahun 4 digit.")

    year = int(normalized)
    if year < BATCH_MIN_YEAR or year > BATCH_MAX_YEAR:
        raise serializers.ValidationError(
            f"Batch harus berada antara {BATCH_MIN_YEAR} dan {BATCH_MAX_YEAR}."
        )

    return normalized


# region Authentication Serializers


class CustomLoginSerializer(BaseLoginSerializer):
    """Custom login serializer that accepts both username and email."""

    username = serializers.CharField(
        label="Username or Email",
        write_only=True,
        required=True,
    )

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        if username and password:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                try:
                    user = User.objects.get(email=username)
                except User.DoesNotExist:
                    msg = "Unable to log in with provided credentials."
                    raise serializers.ValidationError(msg, code="authorization")

            if not user.check_password(password):
                msg = "Unable to log in with provided credentials."
                raise serializers.ValidationError(msg, code="authorization")

            if not user.is_active:
                msg = "User account is disabled."
                raise serializers.ValidationError(msg, code="authorization")

            if not EmailAddress.objects.filter(user=user, verified=True).exists():
                raise serializers.ValidationError(
                    {
                        "detail": "Email belum diverifikasi. Harap cek inbox atau folder spam email Anda. Jika masih bermasalah, hubungi admin.",
                        "code": "email_not_verified",
                    }
                )

            user.backend = "django.contrib.auth.backends.ModelBackend"
            attrs["user"] = user
            return attrs

        msg = 'Must include "username" and "password".'
        raise serializers.ValidationError(msg, code="authorization")

    def get_auth_user(self, username, password):
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            try:
                user = User.objects.get(email=username)
            except User.DoesNotExist:
                return None

        if user.check_password(password) and user.is_active:
            return user
        return None


class CustomRegisterSerializer(RegisterSerializer):
    username = serializers.CharField(required=False, allow_blank=True)
    full_name = serializers.CharField(write_only=True)
    initials = serializers.CharField(required=False, allow_blank=True, max_length=3)
    role = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    institution = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    department = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    batch = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=4)
    id_number = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    user_type = serializers.ChoiceField(
        choices=[choice[0] for choice in Profile.USER_TYPE_CHOICES],
        required=False,
        allow_null=True,
    )
    is_mentor = serializers.BooleanField(required=False, default=False)

    def validate_username(self, username):
        return username

    def validate_role(self, value):
        if value is None or value == "":
            return value
        normalized = ROLE_NORMALIZATION_MAP.get(str(value).upper())
        if normalized:
            return normalized
        valid_roles = {choice[0] for choice in Profile.ROLE_CHOICES}
        if value not in valid_roles:
            raise serializers.ValidationError("Role tidak valid.")
        return value

    def validate_initials(self, value):
        return Profile.normalize_initials(value)

    def validate_department(self, value):
        return _resolve_department_name(value)

    def validate_batch(self, value):
        return _validate_batch_year(value)

    def validate(self, data):
        data = super().validate(data)
        email = data.get("email") or self.initial_data.get("email") or ""
        base = email.split("@")[0] if email else "user"
        data["username"] = _generate_unique_username(base)
        return _apply_role_field_rules(data)

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        full_name = self.validated_data.get("full_name", "").strip()
        data["username"] = self.validated_data.get("username") or data.get("username")
        data["full_name"] = full_name
        return data

    def save(self, request):
        can_assign_profile_fields = _can_assign_profile_fields(request)
        if can_assign_profile_fields:
            setattr(request, "_skip_email_confirmation", True)

        user = super().save(request)
        full_name = self.get_cleaned_data().get("full_name")
        defaults = {
            "user_type": "External",
            "role": "Guest",
        }
        if full_name:
            defaults["full_name"] = full_name
        if self.validated_data.get("initials"):
            defaults["initials"] = self.validated_data["initials"]
        institution = self.validated_data.get("institution")
        if institution:
            defaults["institution"] = institution

        if can_assign_profile_fields:
            role = self.validated_data.get("role")
            department = self.validated_data.get("department")
            batch = self.validated_data.get("batch")
            id_number = self.validated_data.get("id_number")
            user_type = self.validated_data.get("user_type")
            is_mentor = self.validated_data.get("is_mentor")

            if role:
                defaults["role"] = role
            if department:
                defaults["department"] = department
            if batch:
                defaults["batch"] = batch
            if id_number:
                defaults["id_number"] = id_number
            if user_type:
                defaults["user_type"] = user_type
            if is_mentor is not None:
                defaults["is_mentor"] = is_mentor

        Profile.objects.update_or_create(
            user=user,
            defaults=defaults,
        )
        log_admin_action(
            request.user,
            user,
            ADDITION,
            "Created user via CSL Admin (registration).",
        )

        if can_assign_profile_fields:
            email = user.email
            if email:
                email_address, _ = EmailAddress.objects.get_or_create(
                    user=user,
                    email=email,
                    defaults={"verified": True, "primary": True},
                )
                if not email_address.verified or not email_address.primary:
                    email_address.verified = True
                    email_address.primary = True
                    email_address.save(update_fields=["verified", "primary"])
        return user


# endregion Authentication Serializers


# region Profile Serializers


class DepartmentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Department
        fields = ("id", "name", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_name(self, value):
        normalized = re.sub(r"\s+", " ", str(value or "")).strip()
        if not normalized:
            raise serializers.ValidationError("Nama department wajib diisi.")

        queryset = Department.objects.filter(name__iexact=normalized)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Nama department sudah digunakan.")
        return normalized


class AdminDepartmentSerializer(DepartmentSerializer):
    profile_count = serializers.SerializerMethodField()

    class Meta(DepartmentSerializer.Meta):
        fields = DepartmentSerializer.Meta.fields + ("profile_count",)
        read_only_fields = ("id", "profile_count")

    def get_profile_count(self, obj):
        return Profile.objects.filter(department=obj.name).count()


class ProfileSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    email = serializers.EmailField(read_only=True)
    last_login = serializers.DateTimeField(source="user.last_login", read_only=True)
    initials = serializers.CharField(required=False, allow_blank=True, max_length=3)
    role = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    is_mentor = serializers.BooleanField(required=False)
    institution = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Profile
        fields = (
            "id",
            "email",
            "last_login",
            "full_name",
            "initials",
            "role",
            "is_mentor",
            "institution",
            "batch",
            "department",
            "id_number",
            "user_type",
        )
        read_only_fields = ("id", "email")

    def validate_role(self, value):
        if value is None or value == "":
            return None if value == "" else value
        normalized = ROLE_NORMALIZATION_MAP.get(str(value).upper())
        if normalized:
            return normalized
        valid_roles = {choice[0] for choice in Profile.ROLE_CHOICES}
        if value not in valid_roles:
            raise serializers.ValidationError("Role tidak valid.")
        return value

    def validate_user_type(self, value):
        if value in (None, ""):
            return None if value == "" else value
        normalized = USER_TYPE_NORMALIZATION_MAP.get(str(value).strip().upper())
        if normalized:
            return normalized
        valid_user_types = {choice[0] for choice in Profile.USER_TYPE_CHOICES}
        if value not in valid_user_types:
            raise serializers.ValidationError("User type tidak valid.")
        return value

    def validate_initials(self, value):
        return Profile.normalize_initials(value)

    def validate_department(self, value):
        return _resolve_department_name(value)

    def validate_batch(self, value):
        return _validate_batch_year(value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        return _apply_role_field_rules(attrs, instance=self.instance)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user_type = data.get("user_type")
        normalized_user_type = USER_TYPE_NORMALIZATION_MAP.get(str(user_type or "").strip().upper())
        if normalized_user_type:
            data["user_type"] = normalized_user_type
        return data


class RoomPicDetailSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Profile
        fields = (
            "id",
            "full_name",
        )
        read_only_fields = ("id",)


class UserWithProfileSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True, allow_null=True)
    is_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "is_verified",
            "profile",
        )


class UserBulkDeleteSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.CharField(allow_blank=False, trim_whitespace=True),
        allow_empty=False,
        error_messages={
            "empty": "Pilih minimal satu user untuk dihapus.",
        },
    )

    def validate_ids(self, value):
        unique_ids = []
        seen = set()

        for item in value:
            normalized = str(item).strip()
            if not normalized:
                raise serializers.ValidationError("Terdapat ID user yang kosong.")
            if normalized in seen:
                continue
            seen.add(normalized)
            unique_ids.append(normalized)

        if len(unique_ids) != len(value):
            raise serializers.ValidationError("Terdapat ID user yang duplikat.")
        return unique_ids


class RoomPicBulkAssignSerializer(serializers.Serializer):
    room_ids = serializers.ListField(
        child=serializers.CharField(allow_blank=False, trim_whitespace=True),
        allow_empty=False,
        error_messages={
            "empty": "Pilih minimal satu ruangan.",
        },
    )
    pic_ids = serializers.ListField(
        child=serializers.CharField(allow_blank=False, trim_whitespace=True),
        allow_empty=False,
        error_messages={
            "empty": "Pilih minimal satu PIC.",
        },
    )

    def _validate_unique_ids(self, value, label):
        unique_ids = []
        seen = set()

        for item in value:
            normalized = str(item).strip()
            if not normalized:
                raise serializers.ValidationError(f"Terdapat ID {label} yang kosong.")
            if normalized in seen:
                continue
            seen.add(normalized)
            unique_ids.append(normalized)

        if len(unique_ids) != len(value):
            raise serializers.ValidationError(f"Terdapat ID {label} yang duplikat.")
        return unique_ids

    def validate_room_ids(self, value):
        return self._validate_unique_ids(value, "ruangan")

    def validate_pic_ids(self, value):
        return self._validate_unique_ids(value, "PIC")


# endregion Profile Serializers


class AdminProfileSerializer(ProfileSerializer):
    email = serializers.EmailField()
    user_id = serializers.IntegerField(read_only=True, allow_null=True)
    is_verified = serializers.BooleanField(read_only=True)
    has_user = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta(ProfileSerializer.Meta):
        fields = ProfileSerializer.Meta.fields + ("user_id", "is_verified", "has_user", "status")
        read_only_fields = ("id", "user_id", "is_verified", "has_user", "status")

    def validate_email(self, value):
        normalized = normalize_email(value)
        queryset = Profile.objects.filter(email__iexact=normalized)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Email profile sudah digunakan.")
        if self.instance is None and not is_campus_email(normalized):
            raise serializers.ValidationError(
                "Email non-domain kampus harus dibuat sebagai akun dengan password."
            )
        return normalized

    def create(self, validated_data):
        return Profile.objects.create(**validated_data)

    def update(self, instance, validated_data):
        email = validated_data.get("email")
        user = getattr(instance, "user", None)
        if email and user is not None and user.email != email:
            user.email = email
            update_fields = ["email"]
            if not user.username:
                user.username = _generate_unique_username(email.split("@")[0])
                update_fields.append("username")
            user.save(update_fields=update_fields)
        return super().update(instance, validated_data)

    def get_has_user(self, obj):
        return bool(getattr(obj, "user_id", None))

    def get_status(self, obj):
        return "active" if getattr(obj, "user_id", None) else "pre_provisioned"


# region PIC Serializers


class PicUserSerializer(serializers.ModelSerializer):
    profile_id = serializers.UUIDField(source="id", read_only=True)
    full_name = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)
    department = serializers.CharField(read_only=True)
    id_number = serializers.CharField(read_only=True)
    room_names = serializers.SerializerMethodField()
    room_assignments = serializers.SerializerMethodField()
    is_mentor = serializers.BooleanField(read_only=True)

    class Meta:
        model = Profile
        fields = (
            "id",
            "email",
            "profile_id",
            "full_name",
            "role",
            "department",
            "id_number",
            "room_names",
            "room_assignments",
            "is_mentor",
        )

    def get_room_names(self, obj):
        return list(
            obj.rooms_as_pic.order_by("name", "number").values_list("name", flat=True)
        )

    def get_room_assignments(self, obj):
        assignments = obj.rooms_as_pic.order_by("name", "number").values("id", "name", "number")
        return [
            {
                "id": room["id"],
                "name": room["name"],
                "number": room["number"],
                "label": (
                    f'{room["name"]} ({room["number"]})'
                    if room["number"]
                    else room["name"]
                ),
            }
            for room in assignments
        ]


class PicUserDropdownSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    department = serializers.CharField(read_only=True)
    is_mentor = serializers.BooleanField(read_only=True)

    class Meta:
        model = Profile
        fields = (
            "id",
            "name",
            "role",
            "department",
            "is_mentor",
        )

    def get_name(self, obj):
        full_name = getattr(obj, "full_name", None)
        if full_name:
            return full_name
        linked_user = getattr(obj, "user", None)
        if linked_user and getattr(linked_user, "email", None):
            return linked_user.email
        return obj.email

    def get_role(self, obj):
        profile_role = getattr(obj, "role", None)
        if profile_role:
            return profile_role

        linked_user = getattr(obj, "user", None)
        if linked_user is None:
            return None

        if linked_user.groups.filter(name="SuperAdministrator").exists():
            return "Admin"
        if linked_user.groups.filter(name="Administrator").exists():
            return "Admin"
        if linked_user.groups.filter(name="Staff").exists():
            return "Staff"
        if linked_user.groups.filter(name="Lecturer").exists():
            return "Lecturer"
        return None


# endregion PIC Serializers


# region Admin Serializers


class EmailVerificationStatusSerializer(serializers.Serializer):
    email = serializers.EmailField()


class AdminActionSerializer(serializers.ModelSerializer):
    action = serializers.SerializerMethodField()
    actor = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()

    class Meta:
        model = LogEntry
        fields = (
            "id",
            "action_time",
            "action",
            "actor",
            "target",
            "object_id",
            "object_repr",
            "change_message",
        )

    def get_action(self, obj):
        action_map = {
            ADDITION: "create",
            CHANGE: "update",
            DELETION: "delete",
        }
        return action_map.get(obj.action_flag, "unknown")

    def get_actor(self, obj):
        email = getattr(obj.user, "email", "") or ""
        return email or getattr(obj.user, "username", "") or "system"

    def get_target(self, obj):
        if obj.content_type_id:
            return f"{obj.content_type.app_label}.{obj.content_type.model}"
        return "unknown"


class AdminDashboardKpisSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    total_rooms = serializers.IntegerField()
    total_equipments = serializers.IntegerField()
    total_materials = serializers.IntegerField()
    total_software = serializers.IntegerField()
    total_bookings = serializers.IntegerField()
    total_borrows = serializers.IntegerField()
    total_pengujians = serializers.IntegerField()
    users_by_role = serializers.DictField(child=serializers.IntegerField(), required=False)
    bookings_by_status = serializers.DictField(child=serializers.IntegerField(), required=False)
    borrows_by_status = serializers.DictField(child=serializers.IntegerField(), required=False)
    pengujians_by_status = serializers.DictField(child=serializers.IntegerField(), required=False)


# endregion Admin Serializers


# region Utilities


def _normalize_nullable_value(value):
    if value == "":
        return None
    return value


def _apply_role_field_rules(attrs, instance=None):
    role = attrs.get("role", getattr(instance, "role", None)) or "Guest"
    is_mentor = attrs.get("is_mentor", getattr(instance, "is_mentor", False))

    department = _normalize_nullable_value(attrs.get("department", serializers.empty))
    batch = _normalize_nullable_value(attrs.get("batch", serializers.empty))
    id_number = _normalize_nullable_value(attrs.get("id_number", serializers.empty))
    institution = _normalize_nullable_value(attrs.get("institution", serializers.empty))

    if department is not serializers.empty and role not in ROLE_WITH_DEPARTMENT and department:
        raise serializers.ValidationError(
            {"department": "Department hanya boleh diisi untuk Student, Lecturer, atau Admin."}
        )

    if batch is not serializers.empty and role not in ROLE_WITH_BATCH and batch:
        raise serializers.ValidationError(
            {"batch": "Batch hanya boleh diisi untuk Student."}
        )

    if id_number is not serializers.empty and role not in ROLE_WITH_ID_NUMBER and id_number:
        raise serializers.ValidationError(
            {"id_number": "ID Number hanya boleh diisi untuk Student, Lecturer, Staff, atau Admin."}
        )

    if institution is not serializers.empty and role != "Guest" and institution:
        raise serializers.ValidationError(
            {"institution": "Institusi hanya boleh diisi untuk Guest."}
        )

    if role != "Lecturer" and is_mentor:
        raise serializers.ValidationError(
            {"is_mentor": "is_mentor hanya boleh aktif untuk role Lecturer."}
        )

    if role not in ROLE_WITH_DEPARTMENT:
        attrs["department"] = None
    elif department is not serializers.empty:
        attrs["department"] = department

    if role not in ROLE_WITH_BATCH:
        attrs["batch"] = None
    elif batch is not serializers.empty:
        attrs["batch"] = batch

    if role not in ROLE_WITH_ID_NUMBER:
        attrs["id_number"] = None
    elif id_number is not serializers.empty:
        attrs["id_number"] = id_number

    if role != "Guest":
        attrs["institution"] = None
    elif institution is not serializers.empty:
        attrs["institution"] = institution

    attrs["is_mentor"] = bool(is_mentor) if role == "Lecturer" else False
    return attrs


def _can_assign_profile_fields(request):
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False):
        return True
    return user.groups.filter(name__in=ADMIN_ROLE_GROUPS).exists()


def _generate_unique_username(base):
    sanitized = re.sub(r"[^a-zA-Z0-9_]+", "", base).lower()
    username = sanitized or "user"
    max_length = User._meta.get_field("username").max_length

    if len(username) > max_length:
        username = username[:max_length]

    if not User.objects.filter(username=username).exists():
        return username

    alphabet = string.ascii_lowercase + string.digits

    def build_candidate(base_value, suffix_value):
        base_limit = max_length - len(suffix_value)
        trimmed = base_value[:base_limit] if base_limit > 0 else ""
        return f"{trimmed}{suffix_value}" or "user"

    for _ in range(20):
        suffix = "_" + "".join(secrets.choice(alphabet) for _ in range(4))
        candidate = build_candidate(username, suffix)
        if not User.objects.filter(username=candidate).exists():
            return candidate

    suffix_counter = 1
    while True:
        suffix = f"_{suffix_counter}"
        candidate = build_candidate(username, suffix)
        if not User.objects.filter(username=candidate).exists():
            return candidate
        suffix_counter += 1


# endregion Utilities


# region Lab Clearance Serializers


class LabClearanceActiveServiceSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    type = serializers.CharField()
    label = serializers.CharField()
    status = serializers.CharField()
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField(allow_null=True)


class LabClearanceSerializer(serializers.Serializer):
    profile_id = serializers.UUIDField()
    full_name = serializers.CharField()
    id_number = serializers.CharField(allow_null=True)
    email = serializers.CharField()
    department = serializers.CharField(allow_null=True)
    batch = serializers.CharField(allow_null=True)
    role = serializers.CharField()
    is_clear = serializers.BooleanField()
    active_services = LabClearanceActiveServiceSerializer(many=True)
    summary = serializers.DictField()


# endregion Lab Clearance Serializers
