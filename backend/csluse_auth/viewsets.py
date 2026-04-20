import uuid

from allauth.account.models import EmailAddress
from django.contrib.admin.models import CHANGE, DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Count, Exists, OuterRef
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from csluse.models import Booking, Borrow, Equipment, Material, Pengujian, Room, Software
from csluse.viewsets import DefaultPagination

from .audit import log_admin_action
from .models import Profile
from .permissions import (
    SUPER_ADMINISTRATOR,
    IsAdministratorOrAbove,
    IsStaffOrAbove,
    has_role,
)
from .serializers import (
    AdminActionSerializer,
    AdminDashboardKpisSerializer,
    LabClearanceSerializer,
    PicUserDropdownSerializer,
    PicUserSerializer,
    ProfileSerializer,
    UserBulkDeleteSerializer,
    UserWithProfileSerializer,
)


User = get_user_model()


# region Profile Viewsets


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        return Profile.objects.filter(user=self.request.user)

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="mentor-dropdown")
    def mentor_dropdown(self, request):
        queryset = (
            User.objects.select_related("profile")
            .filter(profile__role__iexact="Lecturer", profile__is_mentor=True)
            .order_by("profile__full_name", "email")
        )
        serializer = PicUserDropdownSerializer(queryset, many=True)
        return Response(serializer.data)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Updated own profile via CSL Admin (my profile).",
        )


class AdminProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]
    queryset = Profile.objects.select_related("user").all()
    http_method_names = ["get", "patch"]

    def perform_update(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Updated profile via CSL Admin (profile management).",
        )


# endregion Profile Viewsets


# region User Management Viewsets


class UserWithProfileViewSet(viewsets.ModelViewSet):
    serializer_class = UserWithProfileSerializer
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]
    queryset = User.objects.select_related("profile").all()
    pagination_class = DefaultPagination
    http_method_names = ["get", "delete", "post"]

    def _append_aggregates(self, response, aggregates):
        response.data["aggregates"] = aggregates
        return response

    def _build_role_aggregates(self, queryset):
        return {
            "total": queryset.count(),
            "student": queryset.filter(profile__role__iexact="Student").count(),
            "lecturer": queryset.filter(profile__role__iexact="Lecturer").count(),
            "admin": queryset.filter(profile__role__iexact="Admin").count(),
            "staff": queryset.filter(profile__role__iexact="Staff").count(),
            "guest": queryset.filter(profile__role__iexact="Guest").count(),
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
        is_target_super_admin = has_role(target, SUPER_ADMINISTRATOR) or getattr(
            target,
            "is_superuser",
            False,
        )
        if is_target_super_admin:
            raise PermissionDenied("Tidak bisa menghapus SuperAdministrator.")

    def _delete_user_instance(self, target):
        log_admin_action(
            self.request.user,
            target,
            DELETION,
            "Deleted user via CSL Admin (user management).",
        )
        target.delete()

    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        lookup_value = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)

        if lookup_value is None:
            return super().get_object()

        try:
            uuid.UUID(str(lookup_value))
            return get_object_or_404(queryset, profile__id=lookup_value)
        except ValueError:
            return get_object_or_404(queryset, pk=lookup_value)

    def get_queryset(self):
        request = self.request
        is_mentor = self._parse_is_mentor_filter(request.query_params.get("is_mentor"))

        qs = (
            User.objects.select_related("profile")
            .annotate(
                is_verified=Exists(
                    EmailAddress.objects.filter(user=OuterRef("pk"), verified=True)
                )
            )
        )

        filters = {
            "profile__department__iexact": request.query_params.get("department"),
            "profile__role__iexact": request.query_params.get("role"),
            "profile__batch": request.query_params.get("batch"),
            "profile__user_type__iexact": request.query_params.get("user_type"),
        }
        filters = {key: value for key, value in filters.items() if value}

        if filters:
            qs = qs.filter(**filters)
        if is_mentor is not None:
            qs = qs.filter(profile__is_mentor=is_mentor)

        search_term = request.query_params.get("search") or request.query_params.get("q")
        if search_term:
            qs = qs.filter(
                models.Q(profile__full_name__icontains=search_term)
                | models.Q(email__icontains=search_term)
                | models.Q(profile__id_number__icontains=search_term)
            )

        return qs.order_by("profile__full_name", "email", "pk")

    def list(self, request, *args, **kwargs):
        aggregate_qs = (
            User.objects.select_related("profile")
            .annotate(
                is_verified=Exists(
                    EmailAddress.objects.filter(user=OuterRef("pk"), verified=True)
                )
            )
        )

        department = request.query_params.get("department")
        role = request.query_params.get("role")
        batch = request.query_params.get("batch")
        user_type = request.query_params.get("user_type")
        is_mentor = self._parse_is_mentor_filter(request.query_params.get("is_mentor"))
        search_term = request.query_params.get("search") or request.query_params.get("q")

        base_filters = {
            "profile__department__iexact": department,
            "profile__role__iexact": role,
            "profile__batch": batch,
            "profile__user_type__iexact": user_type,
        }
        base_filters = {key: value for key, value in base_filters.items() if value}

        if base_filters:
            aggregate_qs = aggregate_qs.filter(**base_filters)
        if is_mentor is not None:
            aggregate_qs = aggregate_qs.filter(profile__is_mentor=is_mentor)

        if search_term:
            aggregate_qs = aggregate_qs.filter(
                models.Q(profile__full_name__icontains=search_term)
                | models.Q(email__icontains=search_term)
                | models.Q(profile__id_number__icontains=search_term)
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

    @extend_schema(request=UserBulkDeleteSerializer)
    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        serializer = UserBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        requested_ids = serializer.validated_data["ids"]
        users = self.get_queryset().filter(pk__in=requested_ids)
        users_by_id = {user.pk: user for user in users}

        deleted_ids = []
        failed_ids = []

        for user_id in requested_ids:
            user = users_by_id.get(user_id)
            if user is None:
                failed_ids.append(user_id)
                continue

            try:
                self._ensure_user_deletable(user)
                self._delete_user_instance(user)
                deleted_ids.append(user_id)
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
    http_method_names = ["get"]

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
            User.objects.select_related("profile")
            .filter(
                models.Q(profile__role__iregex=r"^(lecturer|admin)$")
                | models.Q(groups__name__in=["Lecturer", "Administrator"])
            )
            .exclude(groups__name="SuperAdministrator")
            .distinct()
        )

        assigned_only = self._parse_bool_query(self.request.query_params.get("assigned_only"))
        department = self.request.query_params.get("department")
        role = self.request.query_params.get("role")
        room = self.request.query_params.get("room")
        search = self.request.query_params.get("search") or self.request.query_params.get("q")

        if assigned_only is True:
            queryset = queryset.filter(profile__rooms_as_pic__isnull=False).distinct()
        elif assigned_only is False:
            queryset = queryset.filter(profile__rooms_as_pic__isnull=True).distinct()

        if department:
            queryset = queryset.filter(profile__department__iexact=department)

        if role:
            queryset = queryset.filter(profile__role__iexact=role)

        if room:
            queryset = queryset.filter(profile__rooms_as_pic__id=room).distinct()

        if search:
            queryset = queryset.filter(
                models.Q(profile__full_name__icontains=search)
                | models.Q(email__icontains=search)
                | models.Q(profile__id_number__icontains=search)
            )

        return queryset

    @action(detail=False, methods=["get"], url_path="dropdown")
    def dropdown(self, request):
        queryset = (
            self.get_queryset()
            .filter(profile__rooms_as_pic__isnull=False)
            .distinct()
            .order_by("profile__full_name", "email")
        )
        serializer = PicUserDropdownSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="remove-assignments")
    def remove_assignments(self, request, pk=None):
        user = self.get_object()
        profile = getattr(user, "profile", None)
        if profile is None:
            return Response(
                {"detail": "Profile user tidak ditemukan."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
        users = self.get_queryset().filter(pk__in=requested_ids).select_related("profile")
        users_by_id = {user.pk: user for user in users}

        removed_ids = []
        failed_ids = []

        for user_id in requested_ids:
            user = users_by_id.get(user_id)
            profile = getattr(user, "profile", None) if user else None
            if user is None or profile is None:
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


# endregion PIC Management Viewsets


# region Admin Monitoring Viewsets


class AdminActionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminActionSerializer
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]
    http_method_names = ["get"]

    def get_queryset(self):
        return LogEntry.objects.select_related("user", "content_type").order_by("-action_time")

    @action(detail=False, methods=["get"], url_path="recent")
    def recent(self, request):
        queryset = self.get_queryset().exclude(user=request.user)[:10]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request):
        queryset = self.get_queryset().filter(user=request.user)[:10]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


def _status_breakdown(model):
    rows = model.objects.values("status").annotate(n=Count("id"))
    return {row["status"]: row["n"] for row in rows}


class AdminDashboardViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsAdministratorOrAbove]
    http_method_names = ["get"]
    queryset = Profile.objects.none()

    @extend_schema(responses=AdminDashboardKpisSerializer)
    @action(detail=False, methods=["get"], url_path="kpis")
    def kpis(self, request):
        data = {
            "total_users": User.objects.count(),
            "total_rooms": Room.objects.count(),
            "total_equipments": Equipment.objects.count(),
            "total_materials": Material.objects.count(),
            "total_software": Software.objects.count(),
            "total_bookings": Booking.objects.count(),
            "total_borrows": Borrow.objects.count(),
            "total_pengujians": Pengujian.objects.count(),
            "users_by_role": {
                row["role"]: row["n"]
                for row in Profile.objects.filter(role__isnull=False).values("role").annotate(n=Count("id"))
            },
            "bookings_by_status": _status_breakdown(Booking),
            "borrows_by_status": _status_breakdown(Borrow),
            "pengujians_by_status": _status_breakdown(Pengujian),
        }
        return Response(data)


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

        ACTIVE_BORROW_STATUSES = ["Pending", "Approved", "Borrowed", "Returned Pending Inspection", "Overdue"]
        ACTIVE_BOOKING_STATUSES = ["Pending", "Approved"]
        ACTIVE_PENGUJIAN_STATUSES = ["Pending", "Approved", "Diproses", "Menunggu Pembayaran"]

        active_services = []

        for b in Borrow.objects.select_related("equipment").filter(
            requested_by=profile, status__in=ACTIVE_BORROW_STATUSES
        ):
            active_services.append({
                "id": b.id,
                "code": b.code,
                "type": "borrow",
                "label": b.equipment.name if b.equipment else "-",
                "status": b.status,
                "start_time": b.start_time,
                "end_time": b.end_time,
            })

        for bk in Booking.objects.select_related("room").filter(
            requested_by=profile, status__in=ACTIVE_BOOKING_STATUSES
        ):
            active_services.append({
                "id": bk.id,
                "code": bk.code,
                "type": "booking",
                "label": bk.room.name if bk.room else "-",
                "status": bk.status,
                "start_time": bk.start_time,
                "end_time": bk.end_time,
            })

        for p in Pengujian.objects.filter(
            requested_by=profile, status__in=ACTIVE_PENGUJIAN_STATUSES
        ):
            active_services.append({
                "id": p.id,
                "code": p.code,
                "type": "pengujian",
                "label": p.name or "-",
                "status": p.status,
                "start_time": p.created_at,
                "end_time": None,
            })

        borrow_count = sum(1 for s in active_services if s["type"] == "borrow")
        booking_count = sum(1 for s in active_services if s["type"] == "booking")
        pengujian_count = sum(1 for s in active_services if s["type"] == "pengujian")

        data = {
            "profile_id": profile.id,
            "full_name": profile.full_name or profile.user.email,
            "id_number": profile.id_number,
            "email": profile.user.email,
            "department": profile.department,
            "batch": profile.batch,
            "role": profile.role,
            "is_clear": len(active_services) == 0,
            "active_services": active_services,
            "summary": {
                "total_active": len(active_services),
                "borrow_count": borrow_count,
                "booking_count": booking_count,
                "pengujian_count": pengujian_count,
            },
        }
        serializer = LabClearanceSerializer(data)
        return Response(serializer.data)


# endregion Lab Clearance Viewsets
