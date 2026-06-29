import uuid

from allauth.account.models import EmailAddress
from django.contrib.admin.models import CHANGE, DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.db.models.functions import Lower, Trim
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from csluse.models import Booking, Borrow, Equipment, Material, Pengujian, Room, Software
from csluse.viewsets import (
    DefaultPagination,
    _exclude_legacy_bookings,
    _exclude_legacy_pengujians,
)

from .audit import log_admin_action
from .models import Department, Profile
from .permissions import (
    ADMINISTRATOR,
    SUPER_ADMINISTRATOR,
    IsAdministratorOrAbove,
    IsStaffOrAbove,
    has_role,
)
from .serializers import (
    AdminActionSerializer,
    AdminDepartmentSerializer,
    AdminDashboardKpisSerializer,
    AdminProfileSerializer,
    DepartmentSerializer,
    LabClearanceSerializer,
    PicUserDropdownSerializer,
    RoomPicBulkAssignSerializer,
    PicUserSerializer,
    ProfileSerializer,
    UserBulkDeleteSerializer,
)


User = get_user_model()


class AdminProvisioningThrottleBypassMixin:
    """
    Admin-only provisioning endpoints may be called repeatedly during imports.
    """

    throttle_exempt_actions = {"create"}

    def get_throttles(self):
        if getattr(self, "action", None) in self.throttle_exempt_actions:
            return []
        return super().get_throttles()


# region Profile Viewsets


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch"]

    def _get_authenticated_user(self):
        user = getattr(self.request, "user", None)
        if not getattr(user, "is_authenticated", False) or getattr(user, "pk", None) is None:
            raise NotAuthenticated("Autentikasi diperlukan.")
        return user

    def get_queryset(self):
        user = self._get_authenticated_user()
        return Profile.objects.filter(user=user)

    def get_object(self):
        user = self._get_authenticated_user()
        profile, _ = Profile.objects.get_or_create(
            user=user,
            defaults={
                "email": str(getattr(user, "email", "") or "").strip().lower(),
                "user_type": "External",
            },
        )
        return profile

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return Response(serializer.data)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Updated own profile via CSL Admin (my profile).",
        )


class MentorViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get"]

    @action(detail=False, methods=["get"], url_path="dropdown")
    def dropdown(self, request):
        queryset = (
            Profile.objects.select_related("user").prefetch_related("rooms_as_pic")
            .annotate(normalized_profile_role=Lower(Trim("role")))
            .filter(
                models.Q(normalized_profile_role="lecturer")
                | models.Q(user__groups__name="Lecturer")
            )
            .filter(is_mentor=True)
            .distinct()
            .order_by("full_name", "email", "pk")
        )
        serializer = PicUserDropdownSerializer(queryset, many=True)
        return Response(serializer.data)


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    queryset = Department.objects.all().order_by("name", "pk")
    http_method_names = ["get"]
    pagination_class = None


class AdminDepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = AdminDepartmentSerializer
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]
    queryset = Department.objects.all().order_by("name", "pk")
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        queryset = super().get_queryset()
        search_term = self.request.query_params.get("search") or self.request.query_params.get("q")
        if search_term:
            queryset = queryset.filter(name__icontains=search_term)
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Created department via CSL Admin (user management).",
        )

    def perform_update(self, serializer):
        previous_name = serializer.instance.name
        with transaction.atomic():
            instance = serializer.save()
            if previous_name != instance.name:
                Profile.objects.filter(department=previous_name).update(department=instance.name)
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Updated department via CSL Admin (user management).",
        )

    def perform_destroy(self, instance):
        usage_count = Profile.objects.filter(department=instance.name).count()
        if usage_count > 0:
            raise ValidationError(
                {
                    "detail": (
                        "Department tidak bisa dihapus karena masih dipakai profile."
                    ),
                    "profile_count": usage_count,
                }
            )

        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted department via CSL Admin (user management).",
        )
        instance.delete()

    @extend_schema(request=UserBulkDeleteSerializer)
    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        serializer = UserBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested_ids = serializer.validated_data["ids"]
        queryset = self.get_queryset()
        departments_by_id = {
            str(department.pk): department
            for department in queryset.filter(pk__in=requested_ids)
        }

        deleted_ids = []
        failed_ids = []

        for department_id in requested_ids:
            department = departments_by_id.get(str(department_id))
            if department is None:
                failed_ids.append(department_id)
                continue

            usage_count = Profile.objects.filter(department=department.name).count()
            if usage_count > 0:
                failed_ids.append(department_id)
                continue

            log_admin_action(
                request.user,
                department,
                DELETION,
                "Deleted department via CSL Admin (user management bulk).",
            )
            deleted_department_id = str(department.pk)
            department.delete()
            deleted_ids.append(deleted_department_id)

        response_status = status.HTTP_200_OK if deleted_ids else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "deleted_count": len(deleted_ids),
                "failed_count": len(failed_ids),
                "deleted_ids": deleted_ids,
                "failed_ids": failed_ids,
            },
            status=response_status,
        )


class AdminProfileViewSet(AdminProvisioningThrottleBypassMixin, viewsets.ModelViewSet):
    serializer_class = AdminProfileSerializer
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]
    queryset = Profile.objects.select_related("user").all()
    pagination_class = DefaultPagination
    http_method_names = ["get", "post", "patch", "delete"]

    def _parse_is_mentor_filter(self, value):
        if value is None:
            return None

        normalized = str(value).strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
        return None

    def get_queryset(self):
        request = self.request
        is_mentor = self._parse_is_mentor_filter(request.query_params.get("is_mentor"))
        queryset = Profile.objects.select_related("user").annotate(
            is_verified=Exists(
                EmailAddress.objects.filter(user=OuterRef("user_id"), verified=True)
            )
        )

        filters = {
            "department__iexact": request.query_params.get("department"),
            "role__iexact": request.query_params.get("role"),
            "batch": request.query_params.get("batch"),
            "user_type__iexact": request.query_params.get("user_type"),
        }
        filters = {key: value for key, value in filters.items() if value}
        if filters:
            queryset = queryset.filter(**filters)

        if is_mentor is not None:
            queryset = queryset.filter(is_mentor=is_mentor)

        has_user = request.query_params.get("has_user")
        if has_user is not None:
            normalized = str(has_user).strip().lower()
            if normalized in {"true", "1", "yes"}:
                queryset = queryset.filter(user__isnull=False)
            elif normalized in {"false", "0", "no"}:
                queryset = queryset.filter(user__isnull=True)

        search_term = request.query_params.get("search") or request.query_params.get("q")
        if search_term:
            queryset = queryset.filter(
                Q(full_name__icontains=search_term)
                | Q(email__icontains=search_term)
                | Q(id_number__icontains=search_term)
            )

        return queryset.order_by("full_name", "email", "pk")

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        aggregates = {
            "total": queryset.count(),
            "student": queryset.filter(role__iexact="Student").count(),
            "lecturer": queryset.filter(role__iexact="Lecturer").count(),
            "admin": queryset.filter(role__iexact="Admin").count(),
            "staff": queryset.filter(role__iexact="Staff").count(),
            "guest": queryset.filter(role__iexact="Guest").count(),
            "pre_provisioned": queryset.filter(user__isnull=True).count(),
            "active": queryset.filter(user__isnull=False).count(),
        }

        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            response = self.get_paginated_response(serializer.data)
            response.data["aggregates"] = aggregates
            return response
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Created pre-provisioned profile via CSL Admin (profile management).",
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Updated profile via CSL Admin (profile management).",
        )

    def perform_destroy(self, instance):
        if instance.user_id:
            raise PermissionDenied("Profile yang sudah terhubung ke user tidak bisa dihapus dari sini.")
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted pre-provisioned profile via CSL Admin (profile management).",
        )
        instance.delete()

    @action(detail=True, methods=["post"], url_path="confirm-user")
    def confirm_user(self, request, pk=None):
        profile = self.get_object()
        user = getattr(profile, "user", None)

        if user is None:
            raise ValidationError({"detail": "Profile belum terhubung ke akun user."})

        email = str(getattr(user, "email", "") or getattr(profile, "email", "") or "").strip().lower()
        if not email:
            raise ValidationError({"detail": "Email user tidak ditemukan."})

        email_address, _ = EmailAddress.objects.get_or_create(
            user=user,
            email=email,
            defaults={"primary": True},
        )
        email_address.verified = True
        if not email_address.primary:
            email_address.primary = True
        email_address.save(update_fields=["verified", "primary"])

        setattr(profile, "is_verified", True)
        log_admin_action(
            self.request.user,
            profile,
            CHANGE,
            "Confirmed linked user email via CSL Admin (profile management).",
        )
        serializer = self.get_serializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)


# endregion Profile Viewsets


# region User Management Viewsets


class UserWithProfileViewSet(AdminProvisioningThrottleBypassMixin, viewsets.ModelViewSet):
    serializer_class = AdminProfileSerializer
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]
    queryset = Profile.objects.select_related("user").all()
    pagination_class = DefaultPagination
    http_method_names = ["get", "delete", "post"]

    def _append_aggregates(self, response, aggregates):
        response.data["aggregates"] = aggregates
        return response

    def _build_role_aggregates(self, queryset):
        return {
            "total": queryset.count(),
            "student": queryset.filter(role__iexact="Student").count(),
            "lecturer": queryset.filter(role__iexact="Lecturer").count(),
            "admin": queryset.filter(role__iexact="Admin").count(),
            "staff": queryset.filter(role__iexact="Staff").count(),
            "guest": queryset.filter(role__iexact="Guest").count(),
        }

    def _parse_is_mentor_filter(self, value):
        if value is None:
            return None

        normalized = str(value).strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
        return None

    def _ensure_user_deletable(self, target):
        linked_user = getattr(target, "user", None)
        is_target_super_admin = bool(linked_user) and (
            has_role(linked_user, SUPER_ADMINISTRATOR) or getattr(linked_user, "is_superuser", False)
        )
        if is_target_super_admin:
            raise PermissionDenied("Tidak bisa menghapus SuperAdministrator.")

    def _delete_user_instance(self, target):
        profile = target
        user = getattr(profile, "user", None)

        with transaction.atomic():
            if user is not None:
                log_admin_action(
                    self.request.user,
                    user,
                    DELETION,
                    "Deleted linked user via CSL Admin (user management).",
                )
                user.delete()

            log_admin_action(
                self.request.user,
                profile,
                DELETION,
                "Deleted profile via CSL Admin (user management).",
            )
            profile.delete()

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_value = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)

        if lookup_value is None:
            return super().get_object()

        try:
            uuid.UUID(str(lookup_value))
            return get_object_or_404(queryset, pk=lookup_value)
        except ValueError:
            return get_object_or_404(queryset, user_id=lookup_value)

    def get_queryset(self):
        request = self.request
        is_mentor = self._parse_is_mentor_filter(request.query_params.get("is_mentor"))

        qs = (
            Profile.objects.select_related("user")
            .annotate(
                is_verified=Exists(EmailAddress.objects.filter(user=OuterRef("user_id"), verified=True))
            )
        )

        filters = {
            "department__iexact": request.query_params.get("department"),
            "role__iexact": request.query_params.get("role"),
            "batch": request.query_params.get("batch"),
            "user_type__iexact": request.query_params.get("user_type"),
        }
        filters = {key: value for key, value in filters.items() if value}

        if filters:
            qs = qs.filter(**filters)
        if is_mentor is not None:
            qs = qs.filter(is_mentor=is_mentor)

        search_term = request.query_params.get("search") or request.query_params.get("q")
        if search_term:
            qs = qs.filter(
                models.Q(full_name__icontains=search_term)
                | models.Q(email__icontains=search_term)
                | models.Q(id_number__icontains=search_term)
            )

        has_user = request.query_params.get("has_user")
        if has_user is not None:
            normalized = str(has_user).strip().lower()
            if normalized in {"true", "1", "yes"}:
                qs = qs.filter(user__isnull=False)
            elif normalized in {"false", "0", "no"}:
                qs = qs.filter(user__isnull=True)

        return qs.order_by("full_name", "email", "pk")

    def list(self, request, *args, **kwargs):
        aggregate_qs = (
            Profile.objects.select_related("user")
            .annotate(
                is_verified=Exists(EmailAddress.objects.filter(user=OuterRef("user_id"), verified=True))
            )
        )

        department = request.query_params.get("department")
        role = request.query_params.get("role")
        batch = request.query_params.get("batch")
        user_type = request.query_params.get("user_type")
        is_mentor = self._parse_is_mentor_filter(request.query_params.get("is_mentor"))
        search_term = request.query_params.get("search") or request.query_params.get("q")

        base_filters = {
            "department__iexact": department,
            "role__iexact": role,
            "batch": batch,
            "user_type__iexact": user_type,
        }
        base_filters = {key: value for key, value in base_filters.items() if value}

        if base_filters:
            aggregate_qs = aggregate_qs.filter(**base_filters)
        if is_mentor is not None:
            aggregate_qs = aggregate_qs.filter(is_mentor=is_mentor)
        has_user = request.query_params.get("has_user")
        if has_user is not None:
            normalized = str(has_user).strip().lower()
            if normalized in {"true", "1", "yes"}:
                aggregate_qs = aggregate_qs.filter(user__isnull=False)
            elif normalized in {"false", "0", "no"}:
                aggregate_qs = aggregate_qs.filter(user__isnull=True)

        if search_term:
            aggregate_qs = aggregate_qs.filter(
                models.Q(full_name__icontains=search_term)
                | models.Q(email__icontains=search_term)
                | models.Q(id_number__icontains=search_term)
            )

        aggregates = self._build_role_aggregates(aggregate_qs)

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self._append_aggregates(
                self.get_paginated_response(serializer.data),
                aggregates,
            )
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        self._ensure_user_deletable(instance)
        self._delete_user_instance(instance)

    @staticmethod
    def _resolve_profile_by_identifier(queryset, identifier):
        normalized = str(identifier).strip()
        if not normalized:
            return None

        if "@" in normalized:
            return queryset.filter(
                models.Q(email__iexact=normalized)
                | models.Q(user__email__iexact=normalized)
            ).first()

        try:
            parsed_uuid = uuid.UUID(normalized)
            return queryset.filter(pk=parsed_uuid).first()
        except ValueError:
            if normalized.isdigit():
                return queryset.filter(user_id=int(normalized)).first()
            return None

    @extend_schema(request=UserBulkDeleteSerializer)
    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        serializer = UserBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested_ids = serializer.validated_data["ids"]
        queryset = self.get_queryset()
        profiles_by_identifier = {}
        processed_profile_ids = set()

        for requested_id in requested_ids:
            profile = self._resolve_profile_by_identifier(queryset, requested_id)
            if profile is None:
                continue

            profiles_by_identifier[str(requested_id)] = profile
            profiles_by_identifier[str(profile.pk)] = profile
            if profile.user_id is not None:
                profiles_by_identifier[str(profile.user_id)] = profile

        deleted_ids = []
        failed_ids = []

        for user_id in requested_ids:
            profile = profiles_by_identifier.get(str(user_id))
            if profile is None:
                failed_ids.append(user_id)
                continue
            if str(profile.pk) in processed_profile_ids:
                failed_ids.append(user_id)
                continue

            try:
                profile_id = str(profile.pk)
                self._ensure_user_deletable(profile)
                self._delete_user_instance(profile)
                deleted_ids.append(profile_id)
                processed_profile_ids.add(profile_id)
            except PermissionDenied:
                failed_ids.append(user_id)

        response_status = status.HTTP_200_OK if deleted_ids else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "deleted_count": len(deleted_ids),
                "failed_count": len(failed_ids),
                "deleted_ids": deleted_ids,
                "failed_ids": failed_ids,
            },
            status=response_status,
        )


# endregion User Management Viewsets


# region PIC Management Viewsets


class PicUserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PicUserSerializer
    permission_classes = [IsAuthenticated, IsStaffOrAbove]
    http_method_names = ["get", "post"]

    def _parse_bool_query(self, value):
        if value is None:
            return None

        normalized = str(value).strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
        return None

    def get_queryset(self):
        queryset = (
            Profile.objects.select_related("user")
            .annotate(normalized_profile_role=Lower(Trim("role")))
            .filter(
                models.Q(normalized_profile_role__in=["lecturer", "admin"])
                | models.Q(user__groups__name__in=["Lecturer", "Administrator", "Admin"])
            )
            .exclude(user__groups__name="SuperAdministrator")
            .distinct()
        )

        assigned_only = self._parse_bool_query(self.request.query_params.get("assigned_only"))
        department = self.request.query_params.get("department")
        role = self.request.query_params.get("role")
        room = self.request.query_params.get("room")
        search = self.request.query_params.get("search") or self.request.query_params.get("q")

        if assigned_only is True:
            queryset = queryset.filter(rooms_as_pic__isnull=False).distinct()
        elif assigned_only is False:
            queryset = queryset.filter(rooms_as_pic__isnull=True).distinct()

        if department:
            queryset = queryset.filter(department__iexact=department)

        if role:
            normalized_role = role.strip().lower()
            role_filter = models.Q(normalized_profile_role=normalized_role)
            if normalized_role == "lecturer":
                role_filter |= models.Q(user__groups__name="Lecturer")
            elif normalized_role == "admin":
                role_filter |= models.Q(user__groups__name__in=["Admin", "Administrator"])
            queryset = queryset.filter(role_filter)

        if room:
            queryset = queryset.filter(rooms_as_pic__id=room).distinct()

        if search:
            queryset = queryset.filter(
                models.Q(full_name__icontains=search)
                | models.Q(email__icontains=search)
                | models.Q(id_number__icontains=search)
            )

        return queryset

    @action(detail=False, methods=["get"], url_path="dropdown")
    def dropdown(self, request):
        queryset = (
            self.get_queryset()
            .order_by("full_name", "email", "pk")
        )
        serializer = PicUserDropdownSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="assigned-dropdown")
    def assigned_dropdown(self, request):
        queryset = (
            self.get_queryset()
            .filter(rooms_as_pic__isnull=False)
            .distinct()
            .order_by("full_name", "email", "pk")
        )
        serializer = PicUserDropdownSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="remove-assignments")
    def remove_assignments(self, request, pk=None):
        profile = self.get_object()

        removed_count = profile.rooms_as_pic.count()
        profile.rooms_as_pic.clear()
        log_admin_action(
            request.user,
            profile,
            CHANGE,
            "Removed room PIC assignments via CSL Admin (task management).",
        )
        return Response({"removed_count": removed_count}, status=status.HTTP_200_OK)

    @extend_schema(request=UserBulkDeleteSerializer)
    @action(detail=False, methods=["post"], url_path="bulk-remove-assignments")
    def bulk_remove_assignments(self, request):
        serializer = UserBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested_ids = serializer.validated_data["ids"]
        profiles = self.get_queryset().filter(pk__in=requested_ids)
        profiles_by_id = {str(profile.pk): profile for profile in profiles}

        removed_ids = []
        failed_ids = []

        for user_id in requested_ids:
            profile = profiles_by_id.get(str(user_id))
            if profile is None:
                failed_ids.append(user_id)
                continue

            profile.rooms_as_pic.clear()
            log_admin_action(
                request.user,
                profile,
                CHANGE,
                "Removed room PIC assignments via CSL Admin (task management bulk).",
            )
            removed_ids.append(user_id)

        response_status = status.HTTP_200_OK if removed_ids else status.HTTP_400_BAD_REQUEST
        return Response(
            {
                "removed_count": len(removed_ids),
                "failed_count": len(failed_ids),
                "removed_ids": removed_ids,
                "failed_ids": failed_ids,
            },
            status=response_status,
        )

    @extend_schema(request=RoomPicBulkAssignSerializer)
    @action(detail=False, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request):
        serializer = RoomPicBulkAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        room_ids = serializer.validated_data["room_ids"]
        pic_ids = serializer.validated_data["pic_ids"]

        rooms = Room.objects.filter(pk__in=room_ids).prefetch_related("pics")
        profiles = self.get_queryset().filter(pk__in=pic_ids).distinct()

        rooms_by_id = {str(room.pk): room for room in rooms}
        profiles_by_id = {str(profile.pk): profile for profile in profiles}

        missing_room_ids = [room_id for room_id in room_ids if room_id not in rooms_by_id]
        missing_pic_ids = [pic_id for pic_id in pic_ids if pic_id not in profiles_by_id]

        if missing_room_ids or missing_pic_ids:
            detail_parts = []
            if missing_room_ids:
                detail_parts.append("Sebagian ruangan tidak ditemukan.")
            if missing_pic_ids:
                detail_parts.append("Sebagian PIC tidak ditemukan atau tidak valid.")
            raise ValidationError(
                {
                    "detail": " ".join(detail_parts),
                    "room_ids": missing_room_ids,
                    "pic_ids": missing_pic_ids,
                }
            )

        profiles_to_add = list(profiles)
        total_requested_pairs = len(room_ids) * len(pic_ids)
        created_assignment_count = 0

        with transaction.atomic():
            for room_id in room_ids:
                room = rooms_by_id[room_id]
                existing_pic_ids = {str(pic_id) for pic_id in room.pics.values_list("id", flat=True)}
                new_profiles = [
                    profile
                    for profile in profiles_to_add
                    if str(profile.pk) not in existing_pic_ids
                ]
                if not new_profiles:
                    continue

                room.pics.add(*new_profiles)
                created_assignment_count += len(new_profiles)
                log_admin_action(
                    request.user,
                    room,
                    CHANGE,
                    (
                        "Assigned room PICs via CSL Admin (task management bulk assign): "
                        f"{', '.join(profile.full_name or profile.email for profile in new_profiles)}"
                    ),
                )

        skipped_existing_count = max(total_requested_pairs - created_assignment_count, 0)
        return Response(
            {
                "assigned_room_count": len(room_ids),
                "assigned_pic_count": len(pic_ids),
                "created_assignment_count": created_assignment_count,
                "skipped_existing_count": skipped_existing_count,
                "room_ids": room_ids,
                "pic_ids": pic_ids,
            },
            status=status.HTTP_200_OK,
        )


# endregion PIC Management Viewsets


# region Admin Monitoring Viewsets


class AdminActionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminActionSerializer
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]
    http_method_names = ["get"]

    def get_queryset(self):
        admin_actor_filter = (
            Q(user__is_superuser=True)
            | Q(user__groups__name=ADMINISTRATOR)
            | Q(user__groups__name=SUPER_ADMINISTRATOR)
        )
        return (
            LogEntry.objects.select_related("user", "content_type")
            .filter(admin_actor_filter)
            .distinct()
            .order_by("-action_time")
        )

    def _get_authenticated_user_id(self, request):
        user = getattr(request, "user", None)
        if not getattr(user, "is_authenticated", False):
            return None
        return getattr(user, "pk", None)

    @action(detail=False, methods=["get"], url_path="recent")
    def recent(self, request):
        user_id = self._get_authenticated_user_id(request)
        queryset = self.get_queryset()
        if user_id is not None:
            queryset = queryset.exclude(user_id=user_id)
        queryset = queryset[:10]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request):
        user_id = self._get_authenticated_user_id(request)
        queryset = self.get_queryset()
        if user_id is None:
            return Response([])
        queryset = queryset.filter(user_id=user_id)[:10]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


def _status_breakdown(queryset):
    rows = queryset.values("status").annotate(n=Count("id"))
    return {row["status"]: row["n"] for row in rows}


class AdminDashboardViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminDashboardKpisSerializer
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]
    http_method_names = ["get"]
    queryset = Profile.objects.none()

    def _build_dashboard_data(self):
        bookings_qs = _exclude_legacy_bookings(Booking.objects.all())
        pengujians_qs = _exclude_legacy_pengujians(Pengujian.objects.all())

        return {
            "total_users": Profile.objects.count(),
            "total_rooms": Room.objects.count(),
            "total_equipments": Equipment.objects.count(),
            "total_materials": Material.objects.count(),
            "total_software": Software.objects.count(),
            "total_bookings": bookings_qs.count(),
            "total_borrows": Borrow.objects.count(),
            "total_pengujians": pengujians_qs.count(),
            "users_by_role": {
                row["role"]: row["n"]
                for row in Profile.objects.filter(role__isnull=False).values("role").annotate(n=Count("id"))
            },
            "bookings_by_status": _status_breakdown(bookings_qs),
            "borrows_by_status": _status_breakdown(Borrow.objects.all()),
            "pengujians_by_status": _status_breakdown(pengujians_qs),
        }

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self._build_dashboard_data())
        return Response(serializer.data)


# endregion Admin Monitoring Viewsets


# region Lab Clearance Viewsets


class LabClearanceViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]

    @action(detail=False, methods=["get"], url_path="check")
    def check(self, request):
        """GET /api/admin/lab-clearance/check/?profile_id=<uuid>"""
        profile_id = request.query_params.get("profile_id")
        if not profile_id:
            return Response({"detail": "profile_id wajib diisi."}, status=status.HTTP_400_BAD_REQUEST)

        profile = get_object_or_404(Profile, id=profile_id)

        ACTIVE_BORROW_STATUSES = [
            "Borrowed",
            "Returned Pending Inspection",
            "Overdue",
            "Lost/Damaged",
        ]
        active_services = []

        active_borrows = (
            Borrow.objects
            .select_related("equipment")
            .filter(requested_by=profile, status__in=ACTIVE_BORROW_STATUSES)
        )

        for b in active_borrows:
            active_services.append({
                "id": b.id,
                "code": b.code,
                "type": "borrow",
                "label": b.equipment.name if b.equipment else "-",
                "status": b.status,
                "start_time": b.start_time,
                "end_time": b.end_time,
            })

        borrow_count = sum(1 for s in active_services if s["type"] == "borrow")

        data = {
            "profile_id": profile.id,
            "full_name": profile.full_name or profile.email,
            "id_number": profile.id_number,
            "email": profile.email,
            "department": profile.department,
            "batch": profile.batch,
            "role": profile.role,
            "is_clear": len(active_services) == 0,
            "active_services": active_services,
            "summary": {
                "total_active": len(active_services),
                "borrow_count": borrow_count,
                "booking_count": 0,
                "pengujian_count": 0,
            },
        }
        serializer = LabClearanceSerializer(data)
        return Response(serializer.data)


# endregion Lab Clearance Viewsets
