import os
import re
from datetime import datetime, timedelta
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.admin.models import ADDITION, CHANGE, DELETION
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.db import transaction
from django.db.models import Prefetch, Q, Sum
from rest_framework import viewsets, status
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied, ValidationError
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes

from .models import (
    Image,
    Document,
    Room,
    Equipment,
    Material,
    Software,
    Booking,
    Borrow,
    Announcement,
    Schedule,
    FAQ,
    Pengujian,
    Notification,
    SuratBebasLab,
    SuratBebasLabBookingHistory,
)
from .serializers import (
    ImageSerializer,
    DocumentSerializer,
    AdminDocumentListSerializer,
    AdminPengujianDocumentGroupSerializer,
    RoomSerializer,
    RoomListSerializer,
    RoomDropdownSerializer,
    EquipmentSerializer,
    EquipmentListSerializer,
    EquipmentDropdownSerializer,
    MaterialSerializer,
    MaterialListSerializer,
    MaterialDropdownSerializer,
    SoftwareSerializer,
    SoftwareListSerializer,
    BookingSerializer,
    BookingListSerializer,
    BookingUserListSerializer,
    BorrowSerializer,
    RecordBulkDeleteSerializer,
    BulkSetBooleanSerializer,
    BorrowListSerializer,
    AnnouncementListSerializer,
    AnnouncementSerializer,
    ScheduleSerializer,
    FAQSerializer,
    CalendarEventSerializer,
    ScheduleFeedItemSerializer,
    PengujianSerializer,
    PengujianListSerializer,
    DashboardOverviewSerializer,
    NotificationSerializer,
    SuratBebasLabSerializer,
    SuratBebasLabListSerializer,
    SuratBebasLabDocumentSerializer,
    SuratBebasLabBookingHistorySerializer,
    BookingSuggestionSerializer,
)
from csluse_auth.audit import log_admin_action
from csluse_auth.models import Profile
from csluse_auth.permissions import (
    IsStaffOrAbove,
    IsAdministratorOrAbove,
    has_role,
    LECTURER,
    STAFF,
    ADMINISTRATOR,
    SUPER_ADMINISTRATOR,
)
from .notification_service import (
    notify_borrow_overdue,
    notify_new_request_submission,
    notify_post_mentor_approval,
    notify_request_status,
)
from .email_notifications import build_email_context, send_notification_email

STATUS_VALUE_MAP = {
    "pending": "Pending",
    "approved": "Approved",
    "canceled": "Canceled",
    "cancelled": "Canceled",
    "diproses": "Diproses",
    "menunggu pembayaran": "Diproses",
    "waiting_payment": "Diproses",
    "waiting payment": "Diproses",
    "rejected": "Rejected",
    "expired": "Expired",
    "returned_pending_inspection": "Returned Pending Inspection",
    "returned pending inspection": "Returned Pending Inspection",
    "completed": "Completed",
    "borrowed": "Borrowed",
    "returned": "Returned",
    "overdue": "Overdue",
    "lost_damaged": "Lost/Damaged",
    "lost/damaged": "Lost/Damaged",
}

PENGUJIAN_APPROVER_DOCUMENT_TYPES = {
    "testing_agreement",
    "invoice",
    "receipt",
    "test_result_letter",
}

LEGACY_IMPORT_CODE_PREFIX = "CSLUSE020"


def _resolve_legacy_row_index(row, default_index):
    if not isinstance(row, dict):
        return default_index
    try:
        return int(row.get("index") or default_index)
    except (TypeError, ValueError):
        return default_index


def _coerce_legacy_string(value):
    if value is None:
        return ""
    return str(value).strip()


def _coerce_legacy_positive_int(value, default=1):
    text = _coerce_legacy_string(value)
    if not text:
        return default
    try:
        parsed = int(float(text))
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _parse_legacy_datetime_field(value, field_name, *, required=False):
    if value in (None, ""):
        if required:
            raise ValidationError({field_name: f"{field_name} wajib diisi."})
        return None

    if isinstance(value, datetime):
        parsed = value
    else:
        raw = _coerce_legacy_string(value)
        parsed = parse_datetime(raw)
        if parsed is None and " " in raw and "T" not in raw:
            parsed = parse_datetime(raw.replace(" ", "T", 1))

    if parsed is None:
        raise ValidationError({field_name: f"Format {field_name} tidak valid."})
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_default_timezone())
    return parsed


def _normalize_legacy_status(raw_value, allowed_statuses, default_status):
    text = _coerce_legacy_string(raw_value)
    if not text:
        return default_status
    normalized = normalize_status_value(text)
    if normalized in allowed_statuses:
        return normalized
    return default_status


def _validate_legacy_code(candidate, used_codes):
    code = _coerce_legacy_string(candidate).upper().replace(" ", "")
    if not code:
        return ""
    if len(code) > 12:
        raise ValidationError({"code": "Kode maksimal 12 karakter."})
    if code in used_codes:
        raise ValidationError({"code": "Kode duplikat di file import."})
    used_codes.add(code)
    return code


def _generate_legacy_code(model_cls, used_codes, prefix=LEGACY_IMPORT_CODE_PREFIX):
    normalized_prefix = _coerce_legacy_string(prefix).upper().replace(" ", "")
    if not normalized_prefix:
        raise ValidationError({"code": "Prefix kode legacy tidak valid."})
    if len(normalized_prefix) > 9:
        raise ValidationError({"code": "Prefix kode legacy maksimal 9 karakter."})

    last = (
        model_cls.objects.filter(code__startswith=normalized_prefix)
        .order_by("-code")
        .first()
    )
    next_seq = 1
    if last and last.code:
        suffix = last.code[len(normalized_prefix):]
        if suffix.isdigit():
            next_seq = int(suffix) + 1

    while next_seq <= 999:
        candidate = f"{normalized_prefix}{next_seq:03d}"
        if candidate not in used_codes:
            used_codes.add(candidate)
            return candidate
        next_seq += 1

    raise ValidationError({"code": "Kode legacy sudah mencapai batas maksimum."})


def _resolve_profile_reference(row, id_key, email_key):
    profile_id = _coerce_legacy_string(row.get(id_key))
    if profile_id:
        return Profile.objects.filter(id=profile_id).first()

    email = _coerce_legacy_string(row.get(email_key)).lower()
    if email:
        return Profile.objects.select_related("user").filter(user__email__iexact=email).first()

    return None


PENGUJIAN_REQUESTER_DOCUMENT_TYPES = {
    "signed_testing_agreement",
    "payment_proof",
}
PENGUJIAN_DOCUMENT_MAX_SIZE = 5 * 1024 * 1024
ANNOUNCEMENT_IMAGE_SRC_RE = re.compile(
    r"""<img[^>]+src=["'](?P<src>[^"']+)["']""",
    re.IGNORECASE,
)

# region Support Classes
class DefaultPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class BulkDeleteMixin:
    """Generic bulk-delete action for ModelViewSets.

    Subclasses must implement ``check_bulk_delete_permission`` and may override
    ``bulk_delete_success_message`` / ``bulk_delete_failure_message``.
    """

    bulk_delete_success_message: str = "Semua data terpilih berhasil dihapus."
    bulk_delete_failure_message: str = "Sebagian data tidak ditemukan."

    def check_bulk_delete_permission(self, request):
        """Raise PermissionDenied if the caller is not allowed to bulk-delete."""
        raise NotImplementedError

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        self.check_bulk_delete_permission(request)

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        model = self.get_queryset().model
        instance_map = {
            str(item.id): item
            for item in model.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in instance_map]
        deleted_ids = []

        for item_id in ids:
            instance = instance_map.get(str(item_id))
            if instance is None:
                continue
            self.perform_destroy(instance)
            deleted_ids.append(str(item_id))

        response_status = (
            status.HTTP_200_OK if not missing_ids else status.HTTP_207_MULTI_STATUS
        )
        return Response(
            {
                "deleted_ids": deleted_ids,
                "deleted_count": len(deleted_ids),
                "failed_ids": missing_ids,
                "failed_count": len(missing_ids),
                "detail": (
                    self.bulk_delete_success_message
                    if not missing_ids
                    else self.bulk_delete_failure_message
                ),
            },
            status=response_status,
        )


def extract_announcement_image_refs(content: str | None) -> set[str]:
    if not content:
        return set()

    refs: set[str] = set()

    for match in ANNOUNCEMENT_IMAGE_SRC_RE.finditer(content):
        raw_src = (match.group("src") or "").strip()
        if not raw_src:
            continue

        path = urlparse(raw_src).path or raw_src
        marker = "/images/"
        marker_index = path.find(marker)
        if marker_index == -1:
            continue

        relative_path = f"images/{path[marker_index + len(marker):].lstrip('/')}"
        if relative_path != "images/":
            refs.add(relative_path)

    return refs


# endregion


# region ViewSets


# region Media
class ImageViewSet(viewsets.ModelViewSet):
    
    queryset = Image.objects.all().order_by('-created_at')
    serializer_class = ImageSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsStaffOrAbove()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    def perform_create(self, serializer):
        uploaded_image = self.request.FILES.get('image')
        name = os.path.basename(uploaded_image.name) if uploaded_image else ''
        instance = serializer.save(name=name)
        if instance.image and not instance.url:
            instance.url = instance.image.url
            instance.save(update_fields=['url'])


# endregion


# region Inventory
class RoomViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = Room.objects.prefetch_related('pics').order_by('-created_at')
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_serializer_class(self):
        if self.action == "dropdown":
            return RoomDropdownSerializer
        if self.action == "list":
            return RoomListSerializer
        return RoomSerializer

    def get_permissions(self):
        if self.action in {"create", "bulk_create"}:
            return [IsAuthenticated(), IsStaffOrAbove()]
        if self.action in {"update", "partial_update", "destroy", "bulk_delete"}:
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    @extend_schema(
        parameters=[
            OpenApiParameter("pic", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="PIC of the room"),
            OpenApiParameter("pic_id", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="Alias for pic"),
            OpenApiParameter("floor", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("q", OpenApiTypes.STR, OpenApiParameter.QUERY),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        pic_id = self.request.query_params.get('pic') or self.request.query_params.get('pic_id')
        floor = self.request.query_params.get('floor')

        # Filter params: pic, floor, capacity range, created range
        if pic_id:
            qs = qs.filter(pics__id=pic_id).distinct()
        if floor:
            qs = qs.filter(floor=floor)
        query = (self.request.query_params.get('q') or self.request.query_params.get('search') or '').strip()
        if query:
            qs = qs.filter(
                Q(name__icontains=query)
                | Q(number__icontains=query)
                | Q(description__icontains=query)
                | Q(pics__full_name__icontains=query)
                | Q(pics__user__email__icontains=query)
            ).distinct()

        return qs

    def perform_update(self, serializer):
        new_instance = serializer.save()
        log_admin_action(
            self.request.user,
            new_instance,
            CHANGE,
            "Updated room via CSL Admin (inventory).",
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            ADDITION,
            "Created room via CSL Admin (inventory).",
        )

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        rows = request.data.get("rows")
        if not isinstance(rows, list) or not rows:
            return Response(
                {"detail": "rows wajib berupa array dan tidak boleh kosong."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        success_count = 0

        for index, row in enumerate(rows, start=1):
            row_number = row.get("index", index) if isinstance(row, dict) else index
            serializer = self.get_serializer(data=row)
            if serializer.is_valid():
                instance = serializer.save()
                log_admin_action(
                    self.request.user,
                    instance,
                    ADDITION,
                    "Created room via CSL Admin bulk import.",
                )
                results.append(
                    {
                        "index": row_number,
                        "status": "success",
                        "message": "Sukses",
                        "id": str(instance.id),
                    }
                )
                success_count += 1
            else:
                results.append(
                    {
                        "index": row_number,
                        "status": "error",
                        "message": serializer.errors,
                    }
                )

        failed_count = len(results) - success_count
        response_status = (
            status.HTTP_201_CREATED
            if failed_count == 0
            else status.HTTP_207_MULTI_STATUS
        )
        return Response(
            {
                "results": results,
                "success_count": success_count,
                "failed_count": failed_count,
            },
            status=response_status,
        )

    def _delete_room_instance(self, instance):
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted room via CSL Admin (inventory).",
        )
        super().perform_destroy(instance)

    def perform_destroy(self, instance):
        self._delete_room_instance(instance)

    bulk_delete_success_message = "Semua ruangan terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian ruangan tidak ditemukan."

    def check_bulk_delete_permission(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data ruangan.")

    @action(detail=False, methods=['get'], url_path='dropdown')
    def dropdown(self, request):
        queryset = self.get_queryset().order_by('name')
        serializer = RoomDropdownSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = RoomListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def availability(self, request, pk=None):
        room = self.get_object()
        start_raw = request.query_params.get('start')
        end_raw = request.query_params.get('end')

        start = parse_datetime(start_raw) if start_raw else None
        end = parse_datetime(end_raw) if end_raw else None

        if not start or not end:
            return Response(
                {'detail': 'start and end query params (ISO datetime) are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if timezone.is_naive(start):
            start = timezone.make_aware(start, timezone.get_default_timezone())
        if timezone.is_naive(end):
            end = timezone.make_aware(end, timezone.get_default_timezone())
        if start >= end:
            return Response(
                {'detail': 'start must be before end'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        blocking_statuses = ['Pending', 'Approved']
        bookings = (
            Booking.objects
            .filter(
                room=room,
                status__in=blocking_statuses,
                start_time__lt=end,
                end_time__gt=start,
            )
            .values('id', 'start_time', 'end_time', 'status')
        )

        return Response({'occupied': list(bookings)})


class EquipmentViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = (
        Equipment.objects
        .select_related('room')
        .prefetch_related('room__pics')
        .order_by('-created_at')
    )
    serializer_class = EquipmentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_serializer_class(self):
        if self.action == "dropdown":
            return EquipmentDropdownSerializer
        if self.action == "list":
            return EquipmentListSerializer
        return EquipmentSerializer

    def get_permissions(self):
        if self.action in {"create", "bulk_create"}:
            return [IsAuthenticated(), IsStaffOrAbove()]
        if self.action in {
            "update", "partial_update", "destroy", "bulk_delete",
            "bulk_set_shareable", "bulk_set_borrowable",
        }:
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    @extend_schema(
        parameters=[
            OpenApiParameter("status", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("category", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("room", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("pic", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="PIC of the room"),
            OpenApiParameter("pic_id", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="Alias for pic"),
            OpenApiParameter("is_moveable", OpenApiTypes.BOOL, OpenApiParameter.QUERY),
            OpenApiParameter("is_borrowable", OpenApiTypes.BOOL, OpenApiParameter.QUERY),
            OpenApiParameter("q", OpenApiTypes.STR, OpenApiParameter.QUERY),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        category = self.request.query_params.get('category')
        room_id = self.request.query_params.get('room')
        pic_id = self.request.query_params.get('pic') or self.request.query_params.get('pic_id')
        is_moveable = self.request.query_params.get('is_moveable')
        is_borrowable = self.request.query_params.get('is_borrowable')

        # Filter params: status, category, room, pic, is_moveable, is_borrowable, created range
        if is_active_status_filter(status_param):
            qs = qs.filter(status__in=['Approved', 'Completed'])
        elif status_param:
            qs = qs.filter(status=normalize_status_value(status_param))
        if category:
            qs = qs.filter(category=category)
        if room_id:
            qs = qs.filter(room_id=room_id)
        if pic_id:
            qs = qs.filter(room__pics__id=pic_id).distinct()
        if is_moveable is not None:
            if str(is_moveable).lower() in ['true', '1', 'yes']:
                qs = qs.filter(is_moveable=True)
            elif str(is_moveable).lower() in ['false', '0', 'no']:
                qs = qs.filter(is_moveable=False)
        if is_borrowable is not None:
            if str(is_borrowable).lower() in ['true', '1', 'yes']:
                qs = qs.filter(is_borrowable=True)
            elif str(is_borrowable).lower() in ['false', '0', 'no']:
                qs = qs.filter(is_borrowable=False)
        query = (self.request.query_params.get('q') or self.request.query_params.get('search') or '').strip()
        if query:
            qs = qs.filter(
                Q(name__icontains=query)
                | Q(category__icontains=query)
                | Q(status__icontains=query)
                | Q(room__name__icontains=query)
                | Q(description__icontains=query)
            ).distinct()
        return qs

    def perform_update(self, serializer):
        new_instance = serializer.save()
        log_admin_action(
            self.request.user,
            new_instance,
            CHANGE,
            "Updated equipment via CSL Admin (inventory).",
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            ADDITION,
            "Created equipment via CSL Admin (inventory).",
        )

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        rows = request.data.get("rows")
        if not isinstance(rows, list) or not rows:
            return Response(
                {"detail": "rows wajib berupa array dan tidak boleh kosong."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        success_count = 0

        for index, row in enumerate(rows, start=1):
            row_number = row.get("index", index) if isinstance(row, dict) else index
            serializer = self.get_serializer(data=row)
            if serializer.is_valid():
                instance = serializer.save()
                log_admin_action(
                    self.request.user,
                    instance,
                    ADDITION,
                    "Created equipment via CSL Admin bulk import.",
                )
                results.append(
                    {
                        "index": row_number,
                        "status": "success",
                        "message": "Sukses",
                        "id": str(instance.id),
                    }
                )
                success_count += 1
            else:
                results.append(
                    {
                        "index": row_number,
                        "status": "error",
                        "message": serializer.errors,
                    }
                )

        failed_count = len(results) - success_count
        response_status = (
            status.HTTP_201_CREATED
            if failed_count == 0
            else status.HTTP_207_MULTI_STATUS
        )
        return Response(
            {
                "results": results,
                "success_count": success_count,
                "failed_count": failed_count,
            },
            status=response_status,
        )

    def _delete_equipment_instance(self, instance):
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted equipment via CSL Admin (inventory).",
        )
        super().perform_destroy(instance)

    def perform_destroy(self, instance):
        self._delete_equipment_instance(instance)

    bulk_delete_success_message = "Semua peralatan terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian peralatan tidak ditemukan."

    def check_bulk_delete_permission(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data peralatan.")

    def _bulk_set_flag(self, request, field_name):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk mengubah data peralatan.")
        serializer = BulkSetBooleanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]
        value = serializer.validated_data["value"]
        updated = Equipment.objects.filter(id__in=ids).update(**{field_name: value})
        return Response(
            {"detail": f"{updated} peralatan berhasil diperbarui.", "updated_count": updated},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='bulk-set-shareable')
    def bulk_set_shareable(self, request):
        return self._bulk_set_flag(request, "is_shareable")

    @action(detail=False, methods=['post'], url_path='bulk-set-borrowable')
    def bulk_set_borrowable(self, request):
        return self._bulk_set_flag(request, "is_borrowable")

    @action(detail=False, methods=['get'], url_path='dropdown')
    def dropdown(self, request):
        queryset = self.get_queryset().order_by('name')
        serializer = EquipmentDropdownSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = EquipmentListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def availability(self, request, pk=None):
        equipment = self.get_object()
        start_raw = request.query_params.get('start')
        end_raw = request.query_params.get('end')

        start = parse_datetime(start_raw) if start_raw else None
        end = parse_datetime(end_raw) if end_raw else None

        if not start or not end:
            return Response(
                {'detail': 'start and end query params (ISO datetime) are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if timezone.is_naive(start):
            start = timezone.make_aware(start, timezone.get_default_timezone())
        if timezone.is_naive(end):
            end = timezone.make_aware(end, timezone.get_default_timezone())
        if start >= end:
            return Response(
                {'detail': 'start must be before end'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking_block = ['Pending', 'Approved']
        borrow_block = ['Pending', 'Approved', 'Borrowed', 'Overdue', 'Lost/Damaged']

        bookings = (
            Booking.objects
            .filter(
                equipment_items__equipment=equipment,
                status__in=booking_block,
                start_time__lt=end,
                end_time__gt=start,
            )
            .values('id', 'start_time', 'end_time', 'status')
            .distinct()
        )

        borrows = (
            Borrow.objects
            .filter(
                equipment=equipment,
                status__in=borrow_block,
                start_time__lt=end,
                end_time__gt=start,
            )
            .values('id', 'start_time', 'end_time', 'status')
        )

        occupied = (
            [{'type': 'booking', **item} for item in bookings] +
            [{'type': 'borrow', **item} for item in borrows]
        )

        return Response({'occupied': occupied})


class MaterialViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = (
        Material.objects
        .select_related('room')
        .order_by('-created_at')
    )
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_serializer_class(self):
        if self.action == "dropdown":
            return MaterialDropdownSerializer
        if self.action == "list":
            return MaterialListSerializer
        return MaterialSerializer

    def get_permissions(self):
        if self.action in {"create", "bulk_create"}:
            return [IsAuthenticated(), IsStaffOrAbove()]
        if self.action in {"update", "partial_update", "destroy", "bulk_delete"}:
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    @extend_schema(
        parameters=[
            OpenApiParameter("status", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("category", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("room", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("q", OpenApiTypes.STR, OpenApiParameter.QUERY),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        category = self.request.query_params.get('category')
        room_id = self.request.query_params.get('room')
        query = (self.request.query_params.get('q') or self.request.query_params.get('search') or '').strip()

        if status_param:
            qs = qs.filter(status=status_param)
        if category:
            qs = qs.filter(category=category)
        if room_id:
            qs = qs.filter(room_id=room_id)
        if query:
            qs = qs.filter(
                Q(name__icontains=query)
                | Q(category__icontains=query)
                | Q(status__icontains=query)
                | Q(unit__icontains=query)
                | Q(room__name__icontains=query)
                | Q(description__icontains=query)
            ).distinct()
        return qs

    def perform_update(self, serializer):
        new_instance = serializer.save()
        log_admin_action(
            self.request.user,
            new_instance,
            CHANGE,
            "Updated material via CSL Admin (inventory).",
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            ADDITION,
            "Created material via CSL Admin (inventory).",
        )

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        rows = request.data.get("rows")
        if not isinstance(rows, list) or not rows:
            return Response(
                {"detail": "rows wajib berupa array dan tidak boleh kosong."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        success_count = 0

        for index, row in enumerate(rows, start=1):
            row_number = row.get("index", index) if isinstance(row, dict) else index
            serializer = MaterialSerializer(data=row)
            if serializer.is_valid():
                instance = serializer.save()
                log_admin_action(
                    self.request.user,
                    instance,
                    ADDITION,
                    "Created material via CSL Admin bulk import.",
                )
                results.append({
                    "index": row_number,
                    "status": "success",
                    "message": "Sukses",
                    "id": str(instance.id),
                })
                success_count += 1
            else:
                results.append({
                    "index": row_number,
                    "status": "error",
                    "message": serializer.errors,
                })

        failed_count = len(results) - success_count
        response_status = (
            status.HTTP_201_CREATED if failed_count == 0 else status.HTTP_207_MULTI_STATUS
        )
        return Response(
            {
                "results": results,
                "success_count": success_count,
                "failed_count": failed_count,
            },
            status=response_status,
        )

    def _delete_material_instance(self, instance):
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted material via CSL Admin (inventory).",
        )
        super().perform_destroy(instance)

    def perform_destroy(self, instance):
        self._delete_material_instance(instance)

    bulk_delete_success_message = "Semua bahan terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian bahan tidak ditemukan."

    def check_bulk_delete_permission(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data bahan.")

    @action(detail=False, methods=['get'], url_path='dropdown')
    def dropdown(self, request):
        queryset = self.get_queryset().order_by('name')
        serializer = MaterialDropdownSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = MaterialListSerializer(queryset, many=True)
        return Response(serializer.data)


class SoftwareViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = (
        Software.objects
        .select_related('equipment', 'equipment__room')
        .order_by('-created_at')
    )
    serializer_class = SoftwareSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_serializer_class(self):
        if self.action == "list":
            return SoftwareListSerializer
        return SoftwareSerializer

    def get_permissions(self):
        if self.action in {"create", "bulk_create"}:
            return [IsAuthenticated(), IsStaffOrAbove()]
        if self.action in {"update", "partial_update", "destroy", "bulk_delete"}:
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    @extend_schema(
        parameters=[
            OpenApiParameter("equipment", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("room", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("pic", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="PIC of the room"),
            OpenApiParameter("pic_id", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="Alias for pic"),
            OpenApiParameter("q", OpenApiTypes.STR, OpenApiParameter.QUERY),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        equipment_id = self.request.query_params.get('equipment')
        room_id = self.request.query_params.get('room')
        pic_id = self.request.query_params.get('pic') or self.request.query_params.get('pic_id')
        query = (self.request.query_params.get('q') or self.request.query_params.get('search') or '').strip()

        if equipment_id:
            qs = qs.filter(equipment_id=equipment_id)
        if room_id:
            qs = qs.filter(equipment__room_id=room_id)
        if pic_id:
            qs = qs.filter(equipment__room__pics__id=pic_id).distinct()
        if query:
            qs = qs.filter(
                Q(name__icontains=query)
                | Q(version__icontains=query)
                | Q(license_info__icontains=query)
                | Q(description__icontains=query)
                | Q(equipment__name__icontains=query)
                | Q(equipment__room__name__icontains=query)
            ).distinct()
        return qs

    def perform_update(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Updated software via CSL Admin (inventory).",
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            ADDITION,
            "Created software via CSL Admin (inventory).",
        )

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        rows = request.data.get("rows")
        if not isinstance(rows, list) or not rows:
            return Response(
                {"detail": "rows wajib berupa array dan tidak boleh kosong."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        success_count = 0

        for index, row in enumerate(rows, start=1):
            row_number = row.get("index", index) if isinstance(row, dict) else index
            serializer = self.get_serializer(data=row)
            if serializer.is_valid():
                instance = serializer.save()
                log_admin_action(
                    self.request.user,
                    instance,
                    ADDITION,
                    "Created software via CSL Admin bulk import.",
                )
                results.append(
                    {
                        "index": row_number,
                        "status": "success",
                        "message": "Sukses",
                        "id": str(instance.id),
                    }
                )
                success_count += 1
            else:
                results.append(
                    {
                        "index": row_number,
                        "status": "error",
                        "message": serializer.errors,
                    }
                )

        failed_count = len(results) - success_count
        response_status = (
            status.HTTP_201_CREATED
            if failed_count == 0
            else status.HTTP_207_MULTI_STATUS
        )
        return Response(
            {
                "results": results,
                "success_count": success_count,
                "failed_count": failed_count,
            },
            status=response_status,
        )

    def _delete_software_instance(self, instance):
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted software via CSL Admin (inventory).",
        )
        super().perform_destroy(instance)

    def perform_destroy(self, instance):
        self._delete_software_instance(instance)

    bulk_delete_success_message = "Semua software terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian software tidak ditemukan."

    def check_bulk_delete_permission(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data software.")

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = SoftwareListSerializer(queryset, many=True)
        return Response(serializer.data)


# endregion


# region Booking Rooms
class BookingViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = (
        Booking.objects
        .select_related(
            'room',
            'requested_by',
            'approved_by',
            'requester_mentor_profile',
        )
        .prefetch_related('equipment_items__equipment', 'room__pics')
        .order_by('-created_at')
    )
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def _can_access_booking_approval_scope(self):
        return is_reviewer_or_above(self.request.user)

    def _can_manage_all_bookings(self):
        return can_manage_all_approval_records(self.request.user)

    def _current_profile(self):
        return getattr(self.request.user, "profile", None)

    def _is_room_pic_for_booking(self, booking):
        profile = self._current_profile()
        if not profile or not booking.room_id:
            return False
        return booking.room.pics.filter(id=profile.id).exists()

    def _is_booking_mentor(self, booking):
        return _is_assigned_mentor(self.request.user, booking)

    def _can_review_booking(self, booking):
        return (
            self._can_manage_all_bookings()
            or self._is_room_pic_for_booking(booking)
            or self._is_booking_mentor(booking)
        )

    def _can_finalize_booking_review(self, booking):
        return self._can_manage_all_bookings() or self._is_room_pic_for_booking(booking)

    def _ensure_booking_access(self, booking):
        profile = self._current_profile()
        if profile and booking.requested_by_id == profile.id:
            return
        if self._can_review_booking(booking):
            return
        raise PermissionDenied("Anda tidak memiliki akses ke pengajuan peminjaman lab ini.")

    def _ensure_requester_mutation_permission(self, booking):
        profile = self._current_profile()
        if profile is None or booking.requested_by_id != profile.id:
            raise PermissionDenied(
                "Anda hanya dapat mengubah atau menghapus pengajuan peminjaman lab milik sendiri."
            )
        if booking.status != "Pending":
            raise ValidationError(
                {
                    "status": (
                        "Hanya pengajuan peminjaman lab dengan status Pending yang dapat diubah atau dihapus."
                    )
                }
            )

    def _ensure_delete_permission(self, booking):
        if self._can_access_booking_approval_scope():
            return
        self._ensure_requester_mutation_permission(booking)

    def _ensure_requester_cancel_permission(self, booking):
        profile = self._current_profile()
        if profile is None or booking.requested_by_id != profile.id:
            raise PermissionDenied(
                "Anda hanya dapat membatalkan pengajuan peminjaman lab milik sendiri."
            )
        if booking.status != "Approved":
            raise ValidationError(
                {
                    "status": (
                        "Hanya pengajuan peminjaman lab dengan status Approved yang dapat dibatalkan."
                    )
                }
            )

    def _ensure_review_permission(self, booking):
        if not self._can_review_booking(booking):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau Admin yang dapat memproses booking."
            )

        current_profile = self._current_profile()
        if (
            current_profile
            and booking.requested_by_id == current_profile.id
            and not is_administrator_or_above(self.request.user)
        ):
            raise PermissionDenied(
                "Anda tidak dapat memproses pengajuan milik sendiri kecuali sebagai Admin atau SuperAdministrator."
            )

    def _handle_mentor_approval(self, booking, actor_profile):
        booking.is_approved_by_mentor = True
        booking.mentor_approved_at = timezone.now()
        booking.save(update_fields=[
            "is_approved_by_mentor",
            "mentor_approved_at",
            "updated_at",
        ])
        notify_post_mentor_approval(booking, kind="booking", actor_profile=actor_profile)
        serializer = self.get_serializer(booking)
        return Response(serializer.data)

    def _handle_mentor_rejection(self, booking, actor_profile, request):
        serializer = self._transition_serializer(
            booking,
            data={"status": "Rejected", **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(rejected_at=now)
        notify_request_status(
            booking,
            kind="booking",
            status_value="Rejected",
            actor_profile=actor_profile,
            request=request,
        )
        return Response(serializer.data)

    def _ensure_transition(self, booking, allowed_sources, target_status):
        if booking.status not in allowed_sources:
            allowed = ", ".join(allowed_sources)
            raise ValidationError(
                {
                    "status": (
                        f"Transisi ke {target_status} hanya boleh dari status: {allowed}."
                    )
                }
            )

    def _transition_serializer(self, instance, data):
        return self.get_serializer(
            instance,
            data=data,
            partial=True,
            context={
                **self.get_serializer_context(),
                "allow_status_transition": True,
                "allowed_next_status": data.get("status"),
            },
        )

    def _auto_update_booking_statuses(self):
        sync_booking_statuses()

    def get_serializer_class(self):
        if self.action == "list":
            if self._can_access_booking_approval_scope():
                return BookingListSerializer
            return BookingUserListSerializer
        if self.action == "by_month":
            return BookingListSerializer
        return BookingSerializer

    def get_permissions(self):
        if self.action == "legacy_bulk_import":
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    def _append_aggregates(self, response, aggregates):
        response.data["aggregates"] = aggregates
        return response

    def _delete_booking_instance(self, instance):
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted booking record via CSL Admin.",
        )
        instance.delete()

    @extend_schema(
        parameters=[
            OpenApiParameter("status", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("room", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("equipment", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("requested_by", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("reviewer_scope", OpenApiTypes.STR, OpenApiParameter.QUERY, description="mentor or all"),
            OpenApiParameter("department", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("pic", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="PIC of the room"),
            OpenApiParameter("pic_id", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="Alias for pic"),
            OpenApiParameter("start_after", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("end_before", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("created_after", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("created_before", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def _apply_list_filters(self, qs, allow_requester_filter: bool):
        query = (self.request.query_params.get('q') or '').strip()
        status_param = self.request.query_params.get('status')
        room_id = self.request.query_params.get('room')
        equipment_id = self.request.query_params.get('equipment')
        requester_id = self.request.query_params.get('requested_by')
        reviewer_scope = (self.request.query_params.get('reviewer_scope') or '').strip().lower()
        department = self.request.query_params.get('department')
        purpose_param = self.request.query_params.get('purpose')
        pic_id = self.request.query_params.get('pic') or self.request.query_params.get('pic_id')
        start_after = self.request.query_params.get('start_after')
        end_before = self.request.query_params.get('end_before')
        created_after = self.request.query_params.get('created_after')
        created_before = self.request.query_params.get('created_before')

        if query:
            qs = qs.filter(
                Q(code__icontains=query)
                | Q(room__name__icontains=query)
                | Q(requested_by__full_name__icontains=query)
                | Q(requested_by__user__email__icontains=query)
                | Q(purpose__icontains=query)
                | Q(attendee_names__icontains=query)
                | Q(equipment_items__equipment__name__icontains=query)
            ).distinct()
        if is_active_status_filter(status_param):
            qs = qs.filter(
                status__in=[
                    'Approved',
                    'Borrowed',
                    'Returned Pending Inspection',
                    'Returned',
                    'Overdue',
                    'Lost/Damaged',
                ]
            )
        elif status_param:
            qs = qs.filter(status=normalize_status_value(status_param))
        if room_id:
            qs = qs.filter(room_id=room_id)
        if equipment_id:
            qs = qs.filter(equipment_items__equipment_id=equipment_id).distinct()
        if requester_id and allow_requester_filter:
            qs = qs.filter(requested_by_id=requester_id)
        if reviewer_scope == 'mentor':
            profile = self._current_profile()
            if profile is None:
                return qs.none()
            qs = qs.filter(requester_mentor_profile_id=profile.id)
        if department:
            qs = qs.filter(requested_by__department__iexact=department)
        if purpose_param:
            qs = qs.filter(purpose__iexact=purpose_param)
        if pic_id:
            qs = qs.filter(room__pics__id=pic_id).distinct()
        if start_after:
            qs = qs.filter(start_time__gte=start_after)
        if end_before:
            qs = qs.filter(end_time__lte=end_before)
        if created_after:
            qs = qs.filter(created_at__gte=created_after)
        if created_before:
            qs = qs.filter(created_at__lte=created_before)
        return qs

    def _apply_export_search(self, qs):
        query = (self.request.query_params.get('q') or '').strip()
        if not query:
            return qs
        return qs.filter(
            Q(code__icontains=query)
            | Q(room__name__icontains=query)
            | Q(requested_by__full_name__icontains=query)
            | Q(requested_by__user__email__icontains=query)
            | Q(purpose__icontains=query)
            | Q(attendee_names__icontains=query)
            | Q(equipment_items__equipment__name__icontains=query)
        ).distinct()

    def get_queryset(self):
        self._auto_update_booking_statuses()
        qs = super().get_queryset()
        profile = self._current_profile()

        if not self._can_access_booking_approval_scope():
            qs = qs.filter(requested_by=profile)
            return self._apply_list_filters(qs, allow_requester_filter=False)

        if profile is None:
            return qs.none()

        # Admin: bypass filter PIC untuk action detail/aksi (retrieve, approve, dll)
        # atau jika halaman admin mengirim ?unscoped=1.
        _BOOKING_LIST_ACTIONS = {'list', 'all', 'export_all', 'requester_options'}
        if self._can_manage_all_bookings() and (
            self.request.query_params.get('unscoped') == '1'
            or self.action not in _BOOKING_LIST_ACTIONS
        ):
            return self._apply_list_filters(qs, allow_requester_filter=True)

        # Semua reviewer (termasuk admin di halaman dashboard): hanya tampilkan
        # booking di mana mereka adalah PIC ruangan atau dosen pembimbing pemohon.
        qs = qs.filter(
            Q(room__pics__id=profile.id)
            | Q(requester_mentor_profile_id=profile.id)
        ).distinct()
        return self._apply_list_filters(qs, allow_requester_filter=False)

    def perform_create(self, serializer):
        instance = serializer.save(requested_by=getattr(self.request.user, 'profile', None))
        notify_new_request_submission(instance, kind="booking")

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self._ensure_delete_permission(instance)
        self._delete_booking_instance(instance)

    bulk_delete_success_message = "Semua record peminjaman lab terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian record peminjaman lab tidak ditemukan."

    def check_bulk_delete_permission(self, request):
        if not self._can_access_booking_approval_scope():
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data booking.")

    @action(detail=False, methods=['get'], url_path='my')
    def my(self, request):
        self._auto_update_booking_statuses()
        base_qs = super().get_queryset().filter(requested_by=getattr(request.user, "profile", None))
        aggregates = build_status_aggregates(base_qs)
        qs = base_qs
        qs = self._apply_list_filters(qs, allow_requester_filter=False)

        page = self.paginate_queryset(qs)
        serializer = BookingUserListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=['get'], url_path='all')
    def all(self, request):
        if not self._can_access_booking_approval_scope():
            raise PermissionDenied("Anda tidak memiliki akses untuk melihat seluruh data booking.")

        self._auto_update_booking_statuses()
        base_qs = self.get_queryset()
        aggregates = build_status_aggregates(base_qs)
        qs = base_qs
        page = self.paginate_queryset(qs)
        serializer = BookingListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=['get'], url_path='all/export')
    def export_all(self, request):
        if not self._can_access_booking_approval_scope():
            raise PermissionDenied("Anda tidak memiliki akses untuk export data booking.")

        self._auto_update_booking_statuses()
        qs = self.get_queryset()
        qs = self._apply_export_search(qs)
        serializer = BookingListSerializer(qs, many=True)
        return Response({
            "count": qs.count(),
            "generated_at": timezone.now(),
            "results": serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='all/requesters')
    def requester_options(self, request):
        if not self._can_access_booking_approval_scope():
            raise PermissionDenied("Anda tidak memiliki akses untuk melihat daftar pemohon booking.")
        self._auto_update_booking_statuses()
        return build_requester_dropdown_response(self.get_queryset())

    @action(detail=False, methods=['get'], url_path='by-month')
    def by_month(self, request):
        month_str = request.query_params.get('month')
        if not month_str:
            return Response(
                {'detail': 'month query param required, format YYYY-MM'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            year, month = map(int, month_str.split('-'))
            start = timezone.make_aware(datetime(year, month, 1), timezone.get_default_timezone())
        except Exception:
            return Response(
                {'detail': 'month must be in format YYYY-MM'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # compute start of next month
        if month == 12:
            end = timezone.make_aware(datetime(year + 1, 1, 1), timezone.get_default_timezone())
        else:
            end = timezone.make_aware(datetime(year, month + 1, 1), timezone.get_default_timezone())

        statuses = request.query_params.getlist('status') or ['Approved']
        statuses = [normalize_status_value(item) for item in statuses]

        qs = self.get_queryset().filter(
            status__in=statuses,
            start_time__lt=end,
            end_time__gte=start,
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='legacy-bulk-import')
    def legacy_bulk_import(self, request):
        rows = request.data.get("rows")
        if not isinstance(rows, list) or not rows:
            return Response(
                {"detail": "rows wajib berupa array dan tidak boleh kosong."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        instances = []
        success_count = 0
        used_codes = set()
        existing_codes = set(Booking.objects.values_list("code", flat=True))

        for index, row in enumerate(rows, start=1):
            row_number = _resolve_legacy_row_index(row, index)
            try:
                if not isinstance(row, dict):
                    raise ValidationError({"detail": "Setiap row harus berupa object."})

                room_name = (
                    _coerce_legacy_string(row.get("room_name"))
                    or _coerce_legacy_string(row.get("room_number"))
                    or _coerce_legacy_string(row.get("room"))
                )
                if not room_name:
                    raise ValidationError(
                        {"room_name": "room_name wajib diisi untuk import legacy booking."}
                    )
                start_time = _parse_legacy_datetime_field(
                    row.get("start_time"),
                    "start_time",
                    required=True,
                )
                end_time = _parse_legacy_datetime_field(
                    row.get("end_time"),
                    "end_time",
                    required=True,
                )
                if end_time <= start_time:
                    raise ValidationError(
                        {"end_time": "end_time harus setelah start_time."}
                    )

                code = _validate_legacy_code(row.get("code"), used_codes)
                if not code:
                    code = _generate_legacy_code(Booking, used_codes)
                if code in existing_codes:
                    raise ValidationError({"code": "Kode sudah digunakan."})
                existing_codes.add(code)

                requested_by = _resolve_profile_reference(
                    row,
                    "requested_by",
                    "requested_by_email",
                )
                requester_name = _coerce_legacy_string(row.get("requester_name"))
                approved_by = _resolve_profile_reference(
                    row,
                    "approved_by",
                    "approved_by_email",
                )

                status_value = _normalize_legacy_status(
                    row.get("status"),
                    {choice for choice, _label in Booking.STATUS_CHOICES},
                    "Completed",
                )
                attendee_count = _coerce_legacy_positive_int(
                    row.get("attendee_count"),
                    default=1,
                )
                purpose = _coerce_legacy_string(row.get("purpose")) or "Other"

                created_at = _parse_legacy_datetime_field(
                    row.get("created_at"),
                    "created_at",
                ) or start_time
                approved_at = _parse_legacy_datetime_field(
                    row.get("approved_at"),
                    "approved_at",
                )
                rejected_at = _parse_legacy_datetime_field(
                    row.get("rejected_at"),
                    "rejected_at",
                )
                expired_at = _parse_legacy_datetime_field(
                    row.get("expired_at"),
                    "expired_at",
                )
                completed_at = _parse_legacy_datetime_field(
                    row.get("completed_at"),
                    "completed_at",
                )

                if status_value == "Approved" and approved_at is None:
                    approved_at = end_time
                if status_value == "Rejected" and rejected_at is None:
                    rejected_at = end_time
                if status_value == "Expired" and expired_at is None:
                    expired_at = end_time
                if status_value == "Completed":
                    if approved_at is None:
                        approved_at = start_time
                    if completed_at is None:
                        completed_at = end_time

                updated_at = (
                    completed_at
                    or rejected_at
                    or expired_at
                    or approved_at
                    or end_time
                )

                instance = Booking(
                    code=code,
                    requested_by=requested_by,
                    requester_name=(
                        requester_name
                        or (requested_by.full_name if requested_by else None)
                        or (
                            requested_by.user.email
                            if requested_by and getattr(requested_by, "user", None)
                            else None
                        )
                    ),
                    requester_phone=_coerce_legacy_string(row.get("requester_phone")) or None,
                    requester_mentor=_coerce_legacy_string(row.get("requester_mentor")) or None,
                    institution=_coerce_legacy_string(row.get("institution")) or None,
                    institution_address=_coerce_legacy_string(row.get("institution_address")) or None,
                    workshop_title=_coerce_legacy_string(row.get("workshop_title")) or None,
                    workshop_pic=_coerce_legacy_string(row.get("workshop_pic")) or None,
                    workshop_institution=_coerce_legacy_string(row.get("workshop_institution")) or None,
                    room=None,
                    room_name=room_name,
                    start_time=start_time,
                    end_time=end_time,
                    attendee_count=attendee_count,
                    attendee_names=_coerce_legacy_string(row.get("attendee_names")) or None,
                    purpose=purpose,
                    note=_coerce_legacy_string(row.get("note")) or None,
                    status=status_value,
                    approved_by=approved_by,
                    approved_at=approved_at,
                    rejected_at=rejected_at,
                    rejection_note=_coerce_legacy_string(row.get("rejection_note")) or None,
                    expired_at=expired_at,
                    completed_at=completed_at,
                    created_at=created_at,
                    updated_at=updated_at,
                )
                instances.append((row_number, instance))
            except ValidationError as exc:
                results.append(
                    {
                        "index": row_number,
                        "status": "error",
                        "message": getattr(exc, "detail", {"detail": "Data tidak valid."}),
                    }
                )

        if instances:
            with transaction.atomic():
                created_instances = [instance for _row_number, instance in instances]
                Booking.objects.bulk_create(created_instances)
                for row_number, instance in instances:
                    log_admin_action(
                        self.request.user,
                        instance,
                        ADDITION,
                        "Created booking via CSL Admin legacy bulk import.",
                    )
                    results.append(
                        {
                            "index": row_number,
                            "status": "success",
                            "message": "Sukses",
                            "id": str(instance.id),
                        }
                    )
                    success_count += 1

        results.sort(key=lambda item: item.get("index", 0))
        failed_count = len(results) - success_count
        response_status = (
            status.HTTP_201_CREATED
            if failed_count == 0
            else status.HTTP_207_MULTI_STATUS
        )
        return Response(
            {
                "results": results,
                "success_count": success_count,
                "failed_count": failed_count,
            },
            status=response_status,
        )

    @action(detail=True, methods=['get'], url_path='review-check')
    def review_check(self, request, pk=None):
        instance = self.get_object()
        self._ensure_booking_access(instance)
        return Response(_booking_review_result(instance))


    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        actor_profile = getattr(request.user, 'profile', None)
        if _mentor_review_pending(instance):
            if not self._is_booking_mentor(instance):
                raise ValidationError(
                    {"detail": "Pengajuan ini masih menunggu persetujuan dosen pembimbing."}
                )
            return self._handle_mentor_approval(instance, actor_profile)

        if not _can_run_final_pic_review(instance):
            raise ValidationError(
                {"detail": "Pengajuan ini masih menunggu persetujuan dosen pembimbing."}
            )
        if not self._can_finalize_booking_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau Admin yang dapat memberikan persetujuan akhir."
            )
        self._ensure_transition(instance, ["Pending"], "Approved")
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Approved', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(approved_by=actor_profile, approved_at=now)
        notify_request_status(instance, kind="booking", status_value="Approved", actor_profile=actor_profile, request=request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        actor_profile = getattr(request.user, 'profile', None)
        if _mentor_review_pending(instance):
            if not self._is_booking_mentor(instance):
                raise ValidationError(
                    {"detail": "Pengajuan ini masih menunggu persetujuan dosen pembimbing."}
                )
            return self._handle_mentor_rejection(instance, actor_profile, request)

        if not self._can_finalize_booking_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau Admin yang dapat memberikan keputusan akhir."
            )
        self._ensure_transition(instance, ["Pending"], "Rejected")
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Rejected', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(approved_by=actor_profile, rejected_at=now)
        notify_request_status(instance, kind="booking", status_value="Rejected", actor_profile=actor_profile, request=request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        if not self._can_finalize_booking_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau Admin yang dapat menandai booking sebagai selesai."
            )
        self._ensure_transition(instance, ["Approved"], "Completed")
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Completed', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(completed_at=now)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        instance = self.get_object()
        self._ensure_requester_cancel_permission(instance)
        self._ensure_transition(instance, ["Approved"], "Canceled")
        serializer = self._transition_serializer(
            instance,
            data={"status": "Canceled", **request.data},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        notify_request_status(
            instance,
            kind="booking",
            status_value="Canceled",
            actor_profile=getattr(request.user, "profile", None),
            request=request,
        )
        return Response(serializer.data)


# endregion

# region Borrow Equipment
class BorrowViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = (
        Borrow.objects
        .select_related(
            'equipment',
            'equipment__room',
            'requested_by',
            'approved_by',
            'requester_mentor_profile',
        )
        .prefetch_related('equipment__room__pics')
        .order_by('-created_at')
    )
    serializer_class = BorrowSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_serializer_class(self):
        if self.action == "list":
            return BorrowListSerializer
        return BorrowSerializer

    def _current_profile(self):
        return getattr(self.request.user, "profile", None)

    def _can_manage_all_borrows(self):
        return can_manage_all_approval_records(self.request.user)

    def _can_access_borrow_approval(self):
        return is_reviewer_or_above(self.request.user)

    def _is_room_pic_for_borrow(self, borrow):
        profile = self._current_profile()
        room = getattr(getattr(borrow, "equipment", None), "room", None)
        if not profile or room is None:
            return False
        return room.pics.filter(id=profile.id).exists()

    def _is_borrow_mentor(self, borrow):
        return _is_assigned_mentor(self.request.user, borrow)

    def _can_review_borrow(self, borrow):
        return (
            self._can_manage_all_borrows()
            or self._is_room_pic_for_borrow(borrow)
            or self._is_borrow_mentor(borrow)
        )

    def _can_finalize_borrow_review(self, borrow):
        return self._can_manage_all_borrows() or self._is_room_pic_for_borrow(borrow)

    def _ensure_borrow_access(self, borrow):
        profile = self._current_profile()
        if profile and borrow.requested_by_id == profile.id:
            return
        if self._can_review_borrow(borrow):
            return
        raise PermissionDenied("Anda tidak memiliki akses ke pengajuan peminjaman alat ini.")

    def _ensure_requester_mutation_permission(self, borrow):
        profile = self._current_profile()
        if profile is None or borrow.requested_by_id != profile.id:
            raise PermissionDenied(
                "Anda hanya dapat mengubah atau menghapus pengajuan peminjaman alat milik sendiri."
            )
        if borrow.status != "Pending":
            raise ValidationError(
                {
                    "status": (
                        "Hanya pengajuan peminjaman alat dengan status Pending yang dapat diubah atau dihapus."
                    )
                }
            )

    def _ensure_delete_permission(self, borrow):
        if self._can_manage_all_borrows():
            return
        self._ensure_requester_mutation_permission(borrow)

    def _ensure_review_permission(self, borrow):
        if self._can_review_borrow(borrow):
            profile = self._current_profile()
            if (
                profile
                and borrow.requested_by_id == profile.id
                and not is_administrator_or_above(self.request.user)
            ):
                raise PermissionDenied(
                    "Anda tidak dapat memproses pengajuan milik sendiri kecuali sebagai Admin atau SuperAdministrator."
                )
            return
        raise PermissionDenied(
            "Hanya PIC ruangan terkait atau laboran/admin yang dapat memproses borrow ini."
        )

    def _ensure_requester_cancel_permission(self, borrow):
        profile = self._current_profile()
        if profile is None or borrow.requested_by_id != profile.id:
            raise PermissionDenied(
                "Anda hanya dapat membatalkan pengajuan peminjaman alat milik sendiri."
            )
        if borrow.status != "Approved":
            raise ValidationError(
                {
                    "status": (
                        "Hanya pengajuan peminjaman alat dengan status Approved dan belum diserahterimakan yang dapat dibatalkan."
                    )
                }
            )

    def _handle_mentor_approval(self, borrow, actor_profile):
        borrow.is_approved_by_mentor = True
        borrow.mentor_approved_at = timezone.now()
        borrow.save(update_fields=[
            "is_approved_by_mentor",
            "mentor_approved_at",
            "updated_at",
        ])
        notify_post_mentor_approval(borrow, kind="borrow", actor_profile=actor_profile)
        serializer = self.get_serializer(borrow)
        return Response(serializer.data)

    def _handle_mentor_rejection(self, borrow, actor_profile, request):
        serializer = self._transition_serializer(
            borrow,
            data={"status": "Rejected", **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(rejected_at=now)
        notify_request_status(
            borrow,
            kind="borrow",
            status_value="Rejected",
            actor_profile=actor_profile,
            request=request,
        )
        return Response(serializer.data)

    def _ensure_transition(self, borrow, allowed_sources, target_status):
        if borrow.status not in allowed_sources:
            allowed = ", ".join(allowed_sources)
            raise ValidationError(
                {
                    "status": (
                        f"Transisi ke {target_status} hanya boleh dari status: {allowed}."
                    )
                }
            )

    def _transition_serializer(self, instance, data, *, allow_end_time_actual=False):
        return self.get_serializer(
            instance,
            data=data,
            partial=True,
            context={
                **self.get_serializer_context(),
                "allow_status_transition": True,
                "allowed_next_status": data.get("status"),
                "allow_end_time_actual": allow_end_time_actual,
            },
        )

    def _append_aggregates(self, response, aggregates):
        response.data["aggregates"] = aggregates
        return response

    def _delete_borrow_instance(self, instance):
        if not self._can_manage_all_borrows():
            raise PermissionDenied("Hanya laboran/admin yang dapat menghapus record borrow.")
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted borrow record via CSL Admin.",
        )
        instance.delete()

    def _apply_list_filters(
        self,
        qs,
        *,
        allow_requester_filter=False,
        allow_pic_filter=False,
    ):
        query = (self.request.query_params.get('q') or '').strip()
        status_param = self.request.query_params.get('status')
        equipment_id = self.request.query_params.get('equipment')
        room_id = self.request.query_params.get('room')
        requester_id = self.request.query_params.get('requested_by')
        reviewer_scope = (self.request.query_params.get('reviewer_scope') or '').strip().lower()
        department = self.request.query_params.get('department')
        purpose_param = self.request.query_params.get('purpose')
        pic_id = self.request.query_params.get('pic') or self.request.query_params.get('pic_id')
        start_after = self.request.query_params.get('start_after')
        end_before = self.request.query_params.get('end_before')
        created_after = self.request.query_params.get('created_after')
        created_before = self.request.query_params.get('created_before')

        if query:
            qs = qs.filter(
                Q(code__icontains=query)
                | Q(equipment__name__icontains=query)
                | Q(requested_by__full_name__icontains=query)
                | Q(requested_by__user__email__icontains=query)
                | Q(purpose__icontains=query)
            ).distinct()
        if is_active_status_filter(status_param):
            qs = qs.filter(status__in=['Approved', 'Completed'])
        elif status_param:
            qs = qs.filter(status=normalize_status_value(status_param))
        if equipment_id:
            qs = qs.filter(equipment_id=equipment_id)
        if room_id:
            qs = qs.filter(equipment__room_id=room_id)
        if requester_id and allow_requester_filter:
            qs = qs.filter(requested_by_id=requester_id)
        if reviewer_scope == 'mentor':
            profile = self._current_profile()
            if profile is None:
                return qs.none()
            qs = qs.filter(requester_mentor_profile_id=profile.id)
        if department:
            qs = qs.filter(requested_by__department__iexact=department)
        if purpose_param:
            qs = qs.filter(purpose__iexact=purpose_param)
        if pic_id and allow_pic_filter:
            qs = qs.filter(equipment__room__pics__id=pic_id).distinct()
        if start_after:
            qs = qs.filter(start_time__gte=start_after)
        if end_before:
            qs = qs.filter(end_time__lte=end_before)
        if created_after:
            qs = qs.filter(created_at__gte=created_after)
        if created_before:
            qs = qs.filter(created_at__lte=created_before)
        return qs

    @extend_schema(
        parameters=[
            OpenApiParameter("status", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("equipment", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("room", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("requested_by", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("reviewer_scope", OpenApiTypes.STR, OpenApiParameter.QUERY, description="mentor or all"),
            OpenApiParameter("department", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("pic", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="PIC of the equipment's room"),
            OpenApiParameter("pic_id", OpenApiTypes.UUID, OpenApiParameter.QUERY, description="Alias for pic"),
            OpenApiParameter("start_after", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("end_before", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("created_after", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("created_before", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
        ]
    )
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        aggregates = build_borrow_status_aggregates(queryset)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    def get_queryset(self):
        sync_borrow_statuses()
        qs = super().get_queryset()
        profile = self._current_profile()
        if self.action == "my":
            if profile is None:
                return qs.none()
            qs = qs.filter(requested_by_id=profile.id)
            return self._apply_list_filters(qs, allow_requester_filter=False, allow_pic_filter=False)

        if self.action in {"all", "export"}:
            if not self._can_access_borrow_approval():
                return qs.none()
            if profile is None:
                return qs.none()
            # Admin dengan ?unscoped=1 (halaman admin): tampilkan semua.
            if self._can_manage_all_borrows() and self.request.query_params.get('unscoped') == '1':
                return self._apply_list_filters(qs, allow_requester_filter=True, allow_pic_filter=True)
            # Semua reviewer (termasuk admin di dashboard): hanya PIC/mentor.
            qs = qs.filter(
                Q(equipment__room__pics__id=profile.id)
                | Q(requester_mentor_profile_id=profile.id)
            ).distinct()
            return self._apply_list_filters(qs, allow_requester_filter=False, allow_pic_filter=False)

        if self.action == "list":
            if not self._can_manage_all_borrows():
                if profile is None:
                    return qs.none()
                qs = qs.filter(requested_by_id=profile.id)
            return self._apply_list_filters(
                qs,
                allow_requester_filter=self._can_manage_all_borrows(),
                allow_pic_filter=self._can_manage_all_borrows(),
            )

        if not self._can_manage_all_borrows():
            if profile is None:
                return qs.none()
            qs = qs.filter(
                Q(requested_by_id=profile.id)
                | Q(equipment__room__pics__id=profile.id)
                | Q(requester_mentor_profile_id=profile.id)
            ).distinct()
        return self._apply_list_filters(
            qs,
            allow_requester_filter=self._can_manage_all_borrows(),
            allow_pic_filter=self._can_manage_all_borrows(),
        )

    def _apply_export_search(self, qs):
        query = (self.request.query_params.get('q') or '').strip()
        if not query:
            return qs
        return qs.filter(
            Q(code__icontains=query)
            | Q(equipment__name__icontains=query)
            | Q(requested_by__full_name__icontains=query)
            | Q(requested_by__user__email__icontains=query)
            | Q(purpose__icontains=query)
        ).distinct()

    def perform_create(self, serializer):
        instance = serializer.save(requested_by=getattr(self.request.user, 'profile', None))
        notify_new_request_submission(instance, kind="borrow")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_borrow_access(instance)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self._ensure_delete_permission(instance)
        self._delete_borrow_instance(instance)

    bulk_delete_success_message = "Semua record peminjaman alat terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian record peminjaman alat tidak ditemukan."

    def check_bulk_delete_permission(self, request):
        if not self._can_manage_all_borrows():
            raise PermissionDenied("Hanya laboran/admin yang dapat menghapus record borrow.")

    @action(detail=False, methods=['get'], url_path='my')
    def my(self, request):
        sync_borrow_statuses()
        base_qs = super().get_queryset().filter(
            requested_by=getattr(request.user, "profile", None)
        )
        aggregates = build_borrow_status_aggregates(base_qs)
        qs = self._apply_list_filters(base_qs, allow_requester_filter=False, allow_pic_filter=False)
        page = self.paginate_queryset(qs)
        serializer = BorrowListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=['get'], url_path='all')
    def all(self, request):
        if not self._can_access_borrow_approval():
            raise PermissionDenied("Anda tidak memiliki akses untuk melihat seluruh data peminjaman alat.")

        sync_borrow_statuses()
        base_qs = self.get_queryset()
        aggregates = build_borrow_status_aggregates(base_qs)
        qs = base_qs
        page = self.paginate_queryset(qs)
        serializer = BorrowListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=['get'], url_path='by-month')
    def by_month(self, request):
        month_str = request.query_params.get('month')
        if not month_str:
            return Response(
                {'detail': 'month query param required, format YYYY-MM'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            year, month = map(int, month_str.split('-'))
            start = timezone.make_aware(datetime(year, month, 1), timezone.get_default_timezone())
        except Exception:
            return Response(
                {'detail': 'month must be in format YYYY-MM'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if month == 12:
            end = timezone.make_aware(datetime(year + 1, 1, 1), timezone.get_default_timezone())
        else:
            end = timezone.make_aware(datetime(year, month + 1, 1), timezone.get_default_timezone())

        statuses = request.query_params.getlist('status') or ['Approved', 'Borrowed']
        statuses = [normalize_status_value(item) for item in statuses]

        qs = self.get_queryset().filter(
            status__in=statuses,
            start_time__lt=end,
            end_time__gte=start,
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='all/export')
    def export(self, request):
        if not self._can_access_borrow_approval():
            raise PermissionDenied("Anda tidak memiliki akses untuk export data peminjaman alat.")
        qs = self._apply_export_search(self.get_queryset())
        serializer = BorrowListSerializer(qs, many=True)
        return Response({
            "count": qs.count(),
            "generated_at": timezone.now(),
            "results": serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='all/requesters')
    def requester_options(self, request):
        if not self._can_access_borrow_approval():
            raise PermissionDenied("Anda tidak memiliki akses untuk melihat daftar pemohon peminjaman alat.")
        sync_borrow_statuses()
        return build_requester_dropdown_response(self.get_queryset())

    @action(detail=True, methods=['get'], url_path='review-check')
    def review_check(self, request, pk=None):
        instance = self.get_object()
        self._ensure_borrow_access(instance)
        return Response(_borrow_review_result(instance))

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        actor_profile = getattr(request.user, 'profile', None)
        if _mentor_review_pending(instance):
            if not self._is_borrow_mentor(instance):
                raise ValidationError(
                    {"detail": "Pengajuan ini masih menunggu persetujuan dosen pembimbing."}
                )
            return self._handle_mentor_approval(instance, actor_profile)

        if not _can_run_final_pic_review(instance):
            raise ValidationError(
                {"detail": "Pengajuan ini masih menunggu persetujuan dosen pembimbing."}
            )
        if not self._can_finalize_borrow_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau laboran/admin yang dapat memberikan persetujuan akhir."
            )
        self._ensure_transition(instance, ["Pending"], "Approved")

        serializer = self._transition_serializer(
            instance,
            data={'status': 'Approved', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(approved_by=actor_profile, approved_at=now)
        notify_request_status(instance, kind="borrow", status_value="Approved", actor_profile=actor_profile, request=request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        actor_profile = getattr(request.user, 'profile', None)
        if _mentor_review_pending(instance):
            if not self._is_borrow_mentor(instance):
                raise ValidationError(
                    {"detail": "Pengajuan ini masih menunggu persetujuan dosen pembimbing."}
                )
            return self._handle_mentor_rejection(instance, actor_profile, request)

        if not self._can_finalize_borrow_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau laboran/admin yang dapat memberikan keputusan akhir."
            )
        self._ensure_transition(instance, ["Pending"], "Rejected")

        serializer = self._transition_serializer(
            instance,
            data={'status': 'Rejected', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(approved_by=actor_profile, rejected_at=now)
        notify_request_status(instance, kind="borrow", status_value="Rejected", actor_profile=actor_profile, request=request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def handover(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        if not self._can_finalize_borrow_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau laboran/admin yang dapat melakukan serah terima alat."
            )
        self._ensure_transition(instance, ["Approved"], "Borrowed")

        serializer = self._transition_serializer(
            instance,
            data={'status': 'Borrowed', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(borrowed_at=now)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        instance = self.get_object()
        self._ensure_requester_cancel_permission(instance)
        self._ensure_transition(instance, ["Approved"], "Canceled")
        serializer = self._transition_serializer(
            instance,
            data={"status": "Canceled", **request.data},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        notify_request_status(
            instance,
            kind="borrow",
            status_value="Canceled",
            actor_profile=getattr(request.user, "profile", None),
            request=request,
        )
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='receive-return')
    def receive_return(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        if not self._can_finalize_borrow_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau laboran/admin yang dapat menerima pengembalian alat."
            )
        self._ensure_transition(
            instance,
            ["Borrowed", "Overdue"],
            "Returned Pending Inspection",
        )
        end_time_actual = request.data.get('end_time_actual') or timezone.now()

        serializer = self._transition_serializer(
            instance,
            data={
                'status': 'Returned Pending Inspection',
                'end_time_actual': end_time_actual,
                **request.data,
            },
            allow_end_time_actual=True,
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(returned_pending_inspection_at=now)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='finalize-return')
    def finalize_return(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        if not self._can_finalize_borrow_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau laboran/admin yang dapat memfinalisasi return."
            )
        self._ensure_transition(
            instance,
            ["Returned Pending Inspection"],
            "Returned",
        )

        payload = {'status': 'Returned', **request.data}
        if not instance.end_time_actual:
            payload['end_time_actual'] = timezone.now()

        serializer = self._transition_serializer(
            instance,
            data=payload,
            allow_end_time_actual='end_time_actual' in payload,
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(inspected_at=now, returned_at=now)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='mark-damaged')
    def mark_damaged(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        if not self._can_finalize_borrow_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau laboran/admin yang dapat menandai alat sebagai rusak."
            )
        self._ensure_transition(
            instance,
            ["Returned Pending Inspection"],
            "Lost/Damaged",
        )
        inspection_note = str(
            request.data.get("inspection_note") or request.data.get("note") or ""
        ).strip()
        if not inspection_note:
            raise ValidationError({"inspection_note": "Catatan kerusakan wajib diisi."})

        serializer = self._transition_serializer(
            instance,
            data={
                'status': 'Lost/Damaged',
                'inspection_note': inspection_note,
            },
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(inspected_at=now, lost_damaged_at=now)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='mark-lost')
    def mark_lost(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        if not self._can_finalize_borrow_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan terkait atau laboran/admin yang dapat menandai alat sebagai hilang."
            )
        self._ensure_transition(
            instance,
            ["Returned Pending Inspection"],
            "Lost/Damaged",
        )
        inspection_note = str(
            request.data.get("inspection_note") or request.data.get("note") or ""
        ).strip()
        if not inspection_note:
            raise ValidationError({"inspection_note": "Catatan kehilangan wajib diisi."})

        serializer = self._transition_serializer(
            instance,
            data={
                'status': 'Lost/Damaged',
                'inspection_note': inspection_note,
            },
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(inspected_at=now, lost_damaged_at=now)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='return')
    def return_item(self, request, pk=None):
        return self.receive_return(request, pk=pk)


# endregion


# region Content
class AnnouncementViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = Announcement.objects.select_related('created_by').order_by('-created_at')
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def _cleanup_announcement_images(self, instance):
        image_refs = extract_announcement_image_refs(instance.content)
        if not image_refs:
            return

        other_refs: set[str] = set()
        other_contents = (
            Announcement.objects
            .exclude(pk=instance.pk)
            .values_list("content", flat=True)
        )
        for content in other_contents:
            other_refs.update(extract_announcement_image_refs(content))

        removable_refs = image_refs - other_refs
        if not removable_refs:
            return

        images = Image.objects.filter(image__in=removable_refs)

        for image in images:
            image_name = image.image.name if image.image else ""
            if image_name not in removable_refs:
                continue

            if image.image:
                image.image.delete(save=False)
            image.delete()

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get('search') or '').strip()
        ordering = (self.request.query_params.get('ordering') or '-created_at').strip()
        date_value = (self.request.query_params.get('date') or '').strip()

        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(content__icontains=search))

        if date_value:
            parsed_date = parse_date(date_value)
            if not parsed_date:
                raise ValidationError({'date': 'Format tanggal tidak valid. Gunakan YYYY-MM-DD.'})
            qs = qs.filter(created_at__date=parsed_date)

        allowed_ordering = {'created_at', '-created_at'}
        if ordering in allowed_ordering:
            qs = qs.order_by(ordering)

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return AnnouncementListSerializer
        return AnnouncementSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsStaffOrAbove()]
        if self.action in {"update", "partial_update", "destroy", "bulk_delete"}:
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    def perform_create(self, serializer):
        instance = serializer.save(created_by=getattr(self.request.user, 'profile', None))
        log_admin_action(
            self.request.user,
            instance,
            ADDITION,
            "Created announcement via CSL Admin.",
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Updated announcement via CSL Admin.",
        )

    def _delete_announcement_instance(self, instance):
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted announcement via CSL Admin.",
        )
        self._cleanup_announcement_images(instance)
        super().perform_destroy(instance)

    def perform_destroy(self, instance):
        self._delete_announcement_instance(instance)

    bulk_delete_success_message = "Semua pengumuman terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian pengumuman berhasil dihapus."

    def check_bulk_delete_permission(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus pengumuman.")


# endregion


# region Scheduling And Overview
class ScheduleViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = Schedule.objects.select_related('room').order_by('start_time')
    serializer_class = ScheduleSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_permissions(self):
        if self.action in ['create', 'bulk_create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsStaffOrAbove()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        room_id = self.request.query_params.get('room')
        search = self.request.query_params.get('search')
        start_raw = self.request.query_params.get('start')
        end_raw = self.request.query_params.get('end')

        if room_id:
            qs = qs.filter(room_id=room_id)
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(class_name__icontains=search)
            )
        start = parse_datetime(start_raw) if start_raw else None
        end = parse_datetime(end_raw) if end_raw else None
        if start:
            if timezone.is_naive(start):
                start = timezone.make_aware(start, timezone.get_default_timezone())
            qs = qs.filter(end_time__gte=start)
        if end:
            if timezone.is_naive(end):
                end = timezone.make_aware(end, timezone.get_default_timezone())
            qs = qs.filter(start_time__lte=end)

        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            ADDITION,
            "Created schedule via CSL Admin.",
        )

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        rows = request.data.get("rows")
        if not isinstance(rows, list) or not rows:
            return Response(
                {"detail": "rows wajib berupa array dan tidak boleh kosong."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        success_count = 0

        for index, row in enumerate(rows, start=1):
            row_number = row.get("index", index) if isinstance(row, dict) else index
            serializer = self.get_serializer(data=row)
            if serializer.is_valid():
                instance = serializer.save()
                log_admin_action(
                    self.request.user,
                    instance,
                    ADDITION,
                    "Created schedule via CSL Admin bulk import.",
                )
                results.append(
                    {
                        "index": row_number,
                        "status": "success",
                        "message": "Sukses",
                        "id": str(instance.id),
                    }
                )
                success_count += 1
            else:
                results.append(
                    {
                        "index": row_number,
                        "status": "error",
                        "message": serializer.errors,
                    }
                )

        failed_count = len(results) - success_count
        response_status = (
            status.HTTP_201_CREATED
            if failed_count == 0
            else status.HTTP_207_MULTI_STATUS
        )
        return Response(
            {
                "results": results,
                "success_count": success_count,
                "failed_count": failed_count,
            },
            status=response_status,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Updated schedule via CSL Admin.",
        )

    def perform_destroy(self, instance):
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted schedule via CSL Admin.",
        )
        super().perform_destroy(instance)

    bulk_delete_success_message = "Semua jadwal terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian jadwal berhasil dihapus."

    def check_bulk_delete_permission(self, request):
        if not has_staff_management_access(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus jadwal.")

    @extend_schema(
        parameters=[
            OpenApiParameter("page", OpenApiTypes.INT, OpenApiParameter.QUERY),
            OpenApiParameter("page_size", OpenApiTypes.INT, OpenApiParameter.QUERY),
            OpenApiParameter("search", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("room", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("source", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("start", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("end", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("ordering", OpenApiTypes.STR, OpenApiParameter.QUERY),
        ],
        responses=ScheduleFeedItemSerializer(many=True),
    )
    @action(detail=False, methods=['get'], url_path='feed')
    def feed(self, request):
        room_id = request.query_params.get('room')
        search = (request.query_params.get('search') or '').strip()
        source = (request.query_params.get('source') or '').strip().lower()
        ordering = (request.query_params.get('ordering') or 'newest').strip().lower()
        start_raw = request.query_params.get('start')
        end_raw = request.query_params.get('end')

        start = parse_datetime(start_raw) if start_raw else None
        end = parse_datetime(end_raw) if end_raw else None

        if start and timezone.is_naive(start):
            start = timezone.make_aware(start, timezone.get_default_timezone())
        if end and timezone.is_naive(end):
            end = timezone.make_aware(end, timezone.get_default_timezone())

        normalized_query = search.lower()

        schedule_qs = (
            Schedule.objects
            .select_related('room')
            .prefetch_related('room__pics')
            .all()
        )
        booking_qs = (
            Booking.objects
            .filter(status__in=['Approved', 'Completed'])
            .select_related('room', 'requested_by', 'requested_by__user')
        )

        if room_id:
            schedule_qs = schedule_qs.filter(room_id=room_id)
            booking_qs = booking_qs.filter(room_id=room_id)
        if start:
            schedule_qs = schedule_qs.filter(end_time__gte=start)
            booking_qs = booking_qs.filter(end_time__gte=start)
        if end:
            schedule_qs = schedule_qs.filter(start_time__lte=end)
            booking_qs = booking_qs.filter(start_time__lte=end)
        if search:
            schedule_qs = schedule_qs.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )
            booking_qs = booking_qs.filter(
                Q(room__name__icontains=search)
                | Q(note__icontains=search)
                | Q(requested_by__full_name__icontains=search)
                | Q(requested_by__user__email__icontains=search)
                | Q(purpose__icontains=search)
            )

        items = []

        schedule_objects = {}

        if source in ['', 'schedule']:
            for item in schedule_qs:
                schedule_objects[f'schedule-{item.id}'] = item
                items.append({
                    'id': f'schedule-{item.id}',
                    'source': 'schedule',
                    'source_id': str(item.id),
                    'title': item.title,
                    'room_name': item.room.name if item.room else '-',
                    'room_number': item.room.number if item.room else None,
                    'start_time': item.start_time,
                    'end_time': item.end_time,
                    'category_label': str(item.category),
                    'schedule_item': None,
                })

        if source in ['', 'booking']:
            for item in booking_qs:
                title = _event_title_with_requester(
                    item.room.name if item.room else 'Booking',
                    item.requested_by,
                )
                haystack = " ".join([
                    title or '',
                    item.note or '',
                    item.purpose or '',
                    item.room.name if item.room else '',
                    _profile_display_name(item.requested_by) or '',
                ]).lower()
                if normalized_query and normalized_query not in haystack:
                    continue
                items.append({
                    'id': f'booking-{item.id}',
                    'source': 'booking',
                    'source_id': str(item.id),
                    'title': title,
                    'room_name': item.room.name if item.room else '-',
                    'room_number': item.room.number if item.room else None,
                    'start_time': item.start_time,
                    'end_time': item.end_time,
                    'category_label': 'Booking',
                    'schedule_item': None,
                })

        if ordering == 'oldest':
            items.sort(key=lambda item: item['start_time'])
        elif ordering == 'title-asc':
            items.sort(key=lambda item: str(item['title']).lower())
        elif ordering == 'title-desc':
            items.sort(key=lambda item: str(item['title']).lower(), reverse=True)
        else:
            items.sort(key=lambda item: item['start_time'], reverse=True)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(items, request, view=self)

        # Serialize schedule_item only for items on the current page
        for feed_item in page:
            if feed_item['source'] == 'schedule':
                obj = schedule_objects.get(feed_item['id'])
                if obj:
                    feed_item['schedule_item'] = ScheduleSerializer(obj).data

        serializer = ScheduleFeedItemSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class CalendarViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("start", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("end", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("room", OpenApiTypes.UUID, OpenApiParameter.QUERY),
        ],
        responses=CalendarEventSerializer(many=True),
    )
    def list(self, request):
        start_raw = request.query_params.get('start')
        end_raw = request.query_params.get('end')
        room_id = request.query_params.get('room')

        start = parse_datetime(start_raw) if start_raw else None
        end = parse_datetime(end_raw) if end_raw else None

        if not start or not end:
            now = timezone.localtime(timezone.now())
            first_day_current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if first_day_current_month.month == 1:
                start = first_day_current_month.replace(year=first_day_current_month.year - 1, month=12)
            else:
                start = first_day_current_month.replace(month=first_day_current_month.month - 1)

            if first_day_current_month.month == 12:
                next_month = first_day_current_month.replace(year=first_day_current_month.year + 1, month=1)
            else:
                next_month = first_day_current_month.replace(month=first_day_current_month.month + 1)

            if next_month.month == 12:
                month_after_next = next_month.replace(year=next_month.year + 1, month=1)
            else:
                month_after_next = next_month.replace(month=next_month.month + 1)

            if month_after_next.month == 12:
                month_after_that = month_after_next.replace(year=month_after_next.year + 1, month=1)
            else:
                month_after_that = month_after_next.replace(month=month_after_next.month + 1)

            end = month_after_that - timedelta(microseconds=1)

        if timezone.is_naive(start):
            start = timezone.make_aware(start, timezone.get_default_timezone())
        if timezone.is_naive(end):
            end = timezone.make_aware(end, timezone.get_default_timezone())
        if start >= end:
            return Response(
                {'detail': 'start must be before end'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        schedule_qs = (
            Schedule.objects
            .filter(
                start_time__lt=end,
                end_time__gt=start,
            )
            .select_related('room')
        )

        booking_qs = (
            Booking.objects
            .filter(
                status__in=['Approved', 'Completed'],
                start_time__lt=end,
                end_time__gt=start,
            )
            .select_related('room', 'requested_by')
        )

        if room_id:
            schedule_qs = schedule_qs.filter(room_id=room_id)
            booking_qs = booking_qs.filter(room_id=room_id)

        items = []

        for item in schedule_qs:
            items.append({
                'id': str(item.id),
                'source': 'schedule',
                'title': f'Praktikum ({item.title})',
                'start_time': item.start_time,
                'end_time': item.end_time,
                'room_id': item.room_id,
                'room_name': item.room.name if item.room else None,
                'room_number': item.room.number if item.room else None,
                'requested_by_name': item.class_name,
                'attendee_count': None,
                'purpose': None,
            })

        for item in booking_qs:
            room_name = item.room.name if item.room else 'Lab'
            title = f'Peminjaman Lab ({room_name})'
            items.append({
                'id': str(item.id),
                'source': 'booking',
                'title': title,
                'start_time': item.start_time,
                'end_time': item.end_time,
                'room_id': item.room_id,
                'room_name': item.room.name if item.room else None,
                'room_number': item.room.number if item.room else None,
                'requested_by_name': _profile_display_name(item.requested_by),
                'attendee_count': item.attendee_count,
                'purpose': item.purpose,
            })

        items.sort(key=lambda item: (item['start_time'], item['title']))
        serializer = CalendarEventSerializer(items, many=True)
        return Response(serializer.data)


class DashboardOverviewViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        profile = getattr(request.user, "profile", None)
        if not profile:
            return Response(
                {
                    "totals": {
                        "total_requests": 0,
                        "pending": 0,
                        "approved": 0,
                        "completed": 0,
                        "rejected": 0,
                        "expired": 0,
                    },
                    "upcoming_approved": [],
                    "recent_activities": [],
                }
            )

        sync_booking_statuses()
        sync_borrow_statuses()

        now = timezone.now()
        is_pic_scope_role = is_reviewer_or_above(request.user)

        if is_pic_scope_role:
            bookings = list(
                Booking.objects
                .filter(room__pics__id=profile.id)
                .select_related("room", "requested_by")
                .distinct()
                .order_by("-created_at")
            )
            borrows = list(
                Borrow.objects
                .filter(equipment__room__pics__id=profile.id)
                .select_related("equipment", "equipment__room", "requested_by")
                .distinct()
                .order_by("-created_at")
            )
            if is_administrator_or_above(request.user):
                pengujians = list(
                    Pengujian.objects
                    .select_related("requested_by", "approved_by")
                    .order_by("-created_at")
                )
            else:
                pengujians = []
        else:
            bookings = list(
                Booking.objects
                .filter(requested_by=profile)
                .select_related("room")
                .order_by("-created_at")
            )
            borrows = list(
                Borrow.objects
                .filter(requested_by=profile)
                .select_related("equipment", "equipment__room")
                .order_by("-created_at")
            )
            pengujians = list(
                Pengujian.objects
                .filter(requested_by=profile)
                .order_by("-created_at")
            )

        def status_count(items, *statuses):
            normalized_targets = {normalize_status_value(status) for status in statuses}
            return sum(1 for item in items if item.status in normalized_targets)

        upcoming_items = []

        for item in bookings:
            if item.status == "Approved" and item.start_time and item.start_time >= now:
                upcoming_items.append({
                    "id": f"booking-{item.id}",
                    "title": _overview_title(getattr(getattr(item, "room", None), "name", None), item.code or "Booking Ruangan"),
                    "type": "Booking Ruangan",
                    "requester_name": _profile_display_name(getattr(item, "requested_by", None)) or "",
                    "start_time": item.start_time,
                    "end_time": item.end_time,
                    "href": f"/booking-rooms/approval/{item.id}" if is_pic_scope_role else f"/booking-rooms/{item.id}",
                })

        for item in borrows:
            if item.status == "Approved" and item.start_time and item.start_time >= now:
                upcoming_items.append({
                    "id": f"borrow-{item.id}",
                    "title": _overview_title(getattr(getattr(item, "equipment", None), "name", None), item.code or "Peminjaman Alat"),
                    "type": "Peminjaman Alat",
                    "requester_name": _profile_display_name(getattr(item, "requested_by", None)) or "",
                    "start_time": item.start_time,
                    "end_time": item.end_time,
                    "href": f"/borrow-equipment/approval/{item.id}" if is_pic_scope_role else f"/borrow-equipment/{item.id}",
                })

        upcoming_items.sort(key=lambda item: item["start_time"])
        upcoming_approved = upcoming_items

        recent_activities = []

        for item in bookings:
            recent_activities.append({
                "id": f"booking-{item.id}",
                "title": _overview_title(getattr(getattr(item, "room", None), "name", None), item.code or "Booking Ruangan"),
                "code": item.code or "",
                "type": "Booking Ruangan",
                "status": item.status,
                "created_at": item.created_at,
                "href": f"/booking-rooms/approval/{item.id}" if is_pic_scope_role else f"/booking-rooms/{item.id}",
            })

        for item in borrows:
            recent_activities.append({
                "id": f"borrow-{item.id}",
                "title": _overview_title(getattr(getattr(item, "equipment", None), "name", None), item.code or "Peminjaman Alat"),
                "code": item.code or "",
                "type": "Peminjaman Alat",
                "status": item.status,
                "created_at": item.created_at,
                "href": f"/borrow-equipment/approval/{item.id}" if is_pic_scope_role else f"/borrow-equipment/{item.id}",
            })

        for item in pengujians:
            recent_activities.append({
                "id": f"pengujian-{item.id}",
                "title": _overview_title(item.name, item.code or "Pengujian Sampel"),
                "code": item.code or "",
                "type": "Pengujian Sampel",
                "status": item.status,
                "created_at": item.created_at,
                "href": (
                    f"/sample-testing/approval/{item.id}"
                    if is_pic_scope_role and is_administrator_or_above(request.user)
                    else f"/sample-testing/{item.id}"
                ),
            })

        recent_activities.sort(key=lambda item: item["created_at"], reverse=True)

        payload = {
            "totals": {
                "total_requests": len(bookings) + len(borrows) + len(pengujians),
                "pending": (
                    status_count(bookings, "Pending")
                    + status_count(borrows, "Pending")
                    + status_count(pengujians, "Pending")
                ),
                "approved": (
                    status_count(bookings, "Approved")
                    + status_count(borrows, "Approved")
                    + status_count(
                        pengujians,
                        "Approved",
                        "Diproses",
                    )
                ),
                "completed": (
                    status_count(bookings, "Completed")
                    + status_count(borrows, "Returned")
                    + status_count(pengujians, "Completed")
                ),
                "rejected": (
                    status_count(bookings, "Rejected")
                    + status_count(borrows, "Rejected")
                    + status_count(pengujians, "Rejected")
                ),
                "expired": (
                    status_count(bookings, "Expired")
                    + status_count(borrows, "Expired")
                ),
            },
            "upcoming_approved": upcoming_approved,
            "recent_activities": recent_activities[:6],
        }

        serializer = DashboardOverviewSerializer(payload)
        return Response(serializer.data)


# endregion


# region FAQ
class FAQViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = FAQ.objects.order_by('-created_at')
    serializer_class = FAQSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsStaffOrAbove()]
        if self.action in {"update", "partial_update", "destroy", "bulk_delete"}:
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        search = str(self.request.query_params.get("search", "")).strip()
        ordering = str(self.request.query_params.get("ordering", "")).strip()

        if search:
            queryset = queryset.filter(
                Q(question__icontains=search) | Q(answer__icontains=search)
            )

        if ordering == "created_at":
            queryset = queryset.order_by("created_at")
        else:
            queryset = queryset.order_by("-created_at")

        return queryset

    def perform_create(self, serializer):
        instance = serializer.save()
        log_admin_action(
            self.request.user,
            instance,
            ADDITION,
            "Created FAQ via CSL Admin.",
        )

    def perform_update(self, serializer):
        previous_image = getattr(serializer.instance, "image", None)
        instance = serializer.save()
        if previous_image and previous_image != instance.image:
            previous_image.delete(save=False)
        log_admin_action(
            self.request.user,
            instance,
            CHANGE,
            "Updated FAQ via CSL Admin.",
        )

    def _delete_faq_instance(self, instance):
        image = instance.image
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted FAQ via CSL Admin.",
        )
        super().perform_destroy(instance)
        if image:
            image.delete(save=False)

    def perform_destroy(self, instance):
        self._delete_faq_instance(instance)

    bulk_delete_success_message = "Semua FAQ terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian FAQ berhasil dihapus."

    def check_bulk_delete_permission(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus FAQ.")


# endregion


# region Sample Testing
class PengujianViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = (
        Pengujian.objects
        .select_related('requested_by', 'approved_by')
        .prefetch_related('documents__uploaded_by__user')
        .order_by('-created_at')
    )
    serializer_class = PengujianSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_serializer_class(self):
        if self.action == "list":
            return PengujianListSerializer
        return PengujianSerializer

    def get_permissions(self):
        if self.action == "legacy_bulk_import":
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    def _append_aggregates(self, response, aggregates):
        response.data["aggregates"] = aggregates
        return response

    def _delete_pengujian_instance(self, instance):
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted sample testing record via CSL Admin.",
        )
        instance.delete()

    def _can_manage_sample_testing_approval(self):
        return is_administrator_or_above(self.request.user)

    def _current_profile(self):
        return getattr(self.request.user, "profile", None)

    def _is_request_owner(self, pengujian):
        current_profile = self._current_profile()
        return bool(current_profile and pengujian.requested_by_id == current_profile.id)

    def _ensure_requester_mutation_permission(self, pengujian):
        if not self._is_request_owner(pengujian):
            raise PermissionDenied(
                "Anda hanya dapat mengubah atau menghapus pengajuan pengujian sampel milik sendiri."
            )
        if pengujian.status != "Pending":
            raise ValidationError(
                {
                    "status": (
                        "Hanya pengajuan pengujian sampel dengan status Pending yang dapat diubah atau dihapus."
                    )
                }
            )

    def _ensure_delete_permission(self, pengujian):
        if self._can_manage_sample_testing_approval():
            return
        self._ensure_requester_mutation_permission(pengujian)

    def _ensure_review_permission(self, pengujian):
        if not self._can_manage_sample_testing_approval():
            raise PermissionDenied(
                "Hanya Admin atau SuperAdministrator yang dapat memproses pengujian sampel."
            )

        current_profile = self._current_profile()
        if (
            current_profile
            and pengujian.requested_by_id == current_profile.id
            and not is_administrator_or_above(self.request.user)
        ):
            raise PermissionDenied(
                "Anda tidak dapat memproses pengajuan milik sendiri kecuali sebagai Admin atau SuperAdministrator."
            )

    def _ensure_document_upload_permission(self, pengujian, document_type):
        current_profile = self._current_profile()

        if document_type in PENGUJIAN_APPROVER_DOCUMENT_TYPES:
            self._ensure_review_permission(pengujian)
            if (
                pengujian.approved_by_id
                and current_profile
                and pengujian.approved_by_id != current_profile.id
                and not is_administrator_or_above(self.request.user)
            ):
                raise PermissionDenied(
                    "Dokumen approver hanya dapat diunggah oleh approver yang menyetujui atau Admin."
                )
            return

        if document_type in PENGUJIAN_REQUESTER_DOCUMENT_TYPES:
            if self._is_request_owner(pengujian) or is_administrator_or_above(self.request.user):
                return
            raise PermissionDenied(
                "Dokumen requester hanya dapat diunggah oleh pemohon atau Admin."
            )

        raise ValidationError({"document_type": "Jenis dokumen tidak dikenali."})

    def _get_existing_document_map(self, pengujian):
        return {
            document.document_type: document
            for document in pengujian.documents.all()
        }

    def _validate_document_upload_sequence(self, pengujian, document_type, existing_documents):
        if pengujian.status in {"Pending", "Canceled", "Rejected", "Completed"}:
            raise ValidationError(
                {"status": "Dokumen hanya dapat diunggah setelah pengajuan disetujui dan sebelum selesai."}
            )

    def _resolve_pengujian_status_after_document_upload(self, pengujian, document_type):
        if document_type == "testing_agreement" and pengujian.status == "Approved":
            return "Diproses"

        existing_documents = self._get_existing_document_map(pengujian)
        receipt_document = existing_documents.get("receipt")
        test_result_document = existing_documents.get("test_result_letter")
        if (
            receipt_document
            and receipt_document.document
            and test_result_document
            and test_result_document.document
        ):
            return "Completed"

        if pengujian.status == "Approved":
            return pengujian.status
        return pengujian.status

    def _delete_document_file(self, document_instance):
        if not document_instance.document:
            return

        document_name = document_instance.document.name or ""
        document_storage = document_instance.document.storage
        if document_name and document_storage is not None:
            document_storage.delete(document_name)

    def _ensure_transition(self, pengujian, allowed_sources, target_status):
        if pengujian.status not in allowed_sources:
            allowed = ", ".join(allowed_sources)
            raise ValidationError(
                {
                    "status": (
                        f"Transisi ke {target_status} hanya boleh dari status: {allowed}."
                    )
                }
            )

    def _ensure_requester_cancel_permission(self, pengujian):
        profile = getattr(self.request.user, "profile", None)
        if profile is None or pengujian.requested_by_id != profile.id:
            raise PermissionDenied(
                "Anda hanya dapat membatalkan pengajuan pengujian sampel milik sendiri."
            )
        if pengujian.status != "Approved":
            raise ValidationError(
                {
                    "status": (
                        "Hanya pengajuan pengujian sampel dengan status Approved yang dapat dibatalkan."
                    )
                }
            )

    def _transition_serializer(self, instance, data):
        return self.get_serializer(
            instance,
            data=data,
            partial=True,
            context={
                **self.get_serializer_context(),
                "allow_status_transition": True,
                "allowed_next_status": data.get("status"),
            },
        )

    def _apply_list_filters(self, qs, *, allow_requester_filter=False):
        query = (self.request.query_params.get('q') or '').strip()
        status_param = self.request.query_params.get('status')
        requested_by = self.request.query_params.get('requested_by')
        department = self.request.query_params.get('department')
        approved_by = self.request.query_params.get('approved_by')
        created_after = self.request.query_params.get('created_after')
        created_before = self.request.query_params.get('created_before')

        if query:
            qs = qs.filter(
                Q(code__icontains=query)
                | Q(name__icontains=query)
                | Q(institution__icontains=query)
                | Q(email__icontains=query)
                | Q(sample_type__icontains=query)
            ).distinct()
        if is_active_status_filter(status_param):
            qs = qs.filter(status__in=['Approved', 'Completed'])
        elif status_param:
            qs = qs.filter(status=normalize_status_value(status_param))
        if requested_by and allow_requester_filter:
            qs = qs.filter(requested_by_id=requested_by)
        if department:
            qs = qs.filter(requested_by__department__iexact=department)
        if approved_by:
            qs = qs.filter(approved_by_id=approved_by)
        if created_after:
            qs = qs.filter(created_at__gte=created_after)
        if created_before:
            qs = qs.filter(created_at__lte=created_before)
        return qs

    @extend_schema(
        parameters=[
            OpenApiParameter("status", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("requested_by", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("department", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("approved_by", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("created_after", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("created_before", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
        ]
    )
    def list(self, request, *args, **kwargs):
        aggregate_qs = self.get_queryset()
        aggregates = build_status_aggregates(aggregate_qs)
        queryset = self.filter_queryset(aggregate_qs)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "my":
            qs = qs.filter(requested_by=getattr(self.request.user, "profile", None))
            return self._apply_list_filters(qs, allow_requester_filter=False)

        if self.action in {"all", "export"}:
            return self._apply_list_filters(qs, allow_requester_filter=self._can_manage_sample_testing_approval())

        if self.action == "list":
            if not self._can_manage_sample_testing_approval():
                qs = qs.filter(requested_by=getattr(self.request.user, "profile", None))
            return self._apply_list_filters(qs, allow_requester_filter=self._can_manage_sample_testing_approval())

        if not self._can_manage_sample_testing_approval():
            qs = qs.filter(requested_by=getattr(self.request.user, "profile", None))
        return self._apply_list_filters(qs, allow_requester_filter=self._can_manage_sample_testing_approval())

    def _apply_export_search(self, qs):
        query = (self.request.query_params.get('q') or '').strip()
        if not query:
            return qs
        return qs.filter(
            Q(code__icontains=query)
            | Q(name__icontains=query)
            | Q(institution__icontains=query)
            | Q(email__icontains=query)
            | Q(sample_type__icontains=query)
        ).distinct()

    def _apply_document_filters(self, qs):
        query = (self.request.query_params.get("q") or "").strip()
        status_param = self.request.query_params.get("status")
        requested_by = self.request.query_params.get("requested_by")
        department = self.request.query_params.get("department")
        created_after = self.request.query_params.get("created_after")
        created_before = self.request.query_params.get("created_before")
        document_type = (self.request.query_params.get("document_type") or "").strip()
        ordering = (self.request.query_params.get("ordering") or "").strip().lower()

        if query:
            qs = qs.filter(
                Q(pengujian__code__icontains=query)
                | Q(pengujian__name__icontains=query)
                | Q(pengujian__institution__icontains=query)
                | Q(pengujian__email__icontains=query)
                | Q(pengujian__sample_type__icontains=query)
                | Q(original_name__icontains=query)
                | Q(uploaded_by__full_name__icontains=query)
                | Q(uploaded_by__user__email__icontains=query)
            ).distinct()
        if status_param:
            qs = qs.filter(pengujian__status=normalize_status_value(status_param))
        if requested_by:
            qs = qs.filter(pengujian__requested_by_id=requested_by)
        if department:
            qs = qs.filter(pengujian__requested_by__department__iexact=department)
        if created_after:
            qs = qs.filter(created_at__gte=created_after)
        if created_before:
            qs = qs.filter(created_at__lte=created_before)
        if document_type:
            document_types = [
                item.strip()
                for item in document_type.split(",")
                if item.strip()
            ]
            if document_types:
                qs = qs.filter(document_type__in=document_types)
        if ordering == "oldest":
            qs = qs.order_by("created_at", "id")
        else:
            qs = qs.order_by("-created_at", "-id")
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(requested_by=getattr(self.request.user, 'profile', None))
        notify_new_request_submission(instance, kind="pengujian")

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self._ensure_delete_permission(instance)
        self._delete_pengujian_instance(instance)

    bulk_delete_success_message = "Semua record pengujian sampel terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian record pengujian sampel tidak ditemukan."

    def check_bulk_delete_permission(self, request):
        if not self._can_manage_sample_testing_approval():
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data pengujian sampel.")

    @action(detail=False, methods=['get'], url_path='my')
    def my(self, request):
        base_qs = super().get_queryset().filter(
            requested_by=getattr(request.user, "profile", None)
        )
        aggregates = build_status_aggregates(base_qs)
        qs = self._apply_list_filters(base_qs, allow_requester_filter=False)
        page = self.paginate_queryset(qs)
        serializer = PengujianListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=['get'], url_path='all')
    def all(self, request):
        if not self._can_manage_sample_testing_approval():
            raise PermissionDenied("Anda tidak memiliki akses untuk melihat seluruh data pengujian sampel.")

        base_qs = super().get_queryset()
        aggregates = build_status_aggregates(base_qs)
        qs = self._apply_list_filters(base_qs, allow_requester_filter=True)
        page = self.paginate_queryset(qs)
        serializer = PengujianListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=['post'], url_path='legacy-bulk-import')
    def legacy_bulk_import(self, request):
        rows = request.data.get("rows")
        if not isinstance(rows, list) or not rows:
            return Response(
                {"detail": "rows wajib berupa array dan tidak boleh kosong."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        instances = []
        success_count = 0
        used_codes = set()
        existing_codes = set(Pengujian.objects.values_list("code", flat=True))

        for index, row in enumerate(rows, start=1):
            row_number = _resolve_legacy_row_index(row, index)
            try:
                if not isinstance(row, dict):
                    raise ValidationError({"detail": "Setiap row harus berupa object."})

                name = _coerce_legacy_string(row.get("name"))
                email = _coerce_legacy_string(row.get("email"))
                sample_type = _coerce_legacy_string(row.get("sample_type"))
                if not name:
                    raise ValidationError({"name": "name wajib diisi."})
                if not email:
                    raise ValidationError({"email": "email wajib diisi."})
                if not sample_type:
                    raise ValidationError({"sample_type": "sample_type wajib diisi."})

                code = _validate_legacy_code(row.get("code"), used_codes)
                if not code:
                    code = _generate_legacy_code(Pengujian, used_codes)
                if code in existing_codes:
                    raise ValidationError({"code": "Kode sudah digunakan."})
                existing_codes.add(code)

                requested_by = _resolve_profile_reference(
                    row,
                    "requested_by",
                    "requested_by_email",
                )
                approved_by = _resolve_profile_reference(
                    row,
                    "approved_by",
                    "approved_by_email",
                )
                status_value = _normalize_legacy_status(
                    row.get("status"),
                    {choice for choice, _label in Pengujian.STATUS_CHOICES},
                    "Completed",
                )

                created_at = _parse_legacy_datetime_field(
                    row.get("created_at"),
                    "created_at",
                ) or timezone.now()
                approved_at = _parse_legacy_datetime_field(
                    row.get("approved_at"),
                    "approved_at",
                )
                rejected_at = _parse_legacy_datetime_field(
                    row.get("rejected_at"),
                    "rejected_at",
                )
                completed_at = _parse_legacy_datetime_field(
                    row.get("completed_at"),
                    "completed_at",
                )

                if status_value == "Approved" and approved_at is None:
                    approved_at = created_at
                if status_value == "Rejected" and rejected_at is None:
                    rejected_at = created_at
                if status_value == "Completed":
                    if approved_at is None:
                        approved_at = created_at
                    if completed_at is None:
                        completed_at = created_at

                updated_at = completed_at or rejected_at or approved_at or created_at

                instance = Pengujian(
                    code=code,
                    name=name,
                    institution=_coerce_legacy_string(row.get("institution")) or None,
                    institution_address=_coerce_legacy_string(row.get("institution_address")) or None,
                    email=email,
                    phone_number=_coerce_legacy_string(row.get("phone_number")) or None,
                    sample_name=_coerce_legacy_string(row.get("sample_name")) or None,
                    sample_type=sample_type,
                    sample_brand=_coerce_legacy_string(row.get("sample_brand")) or None,
                    sample_packaging=_coerce_legacy_string(row.get("sample_packaging")) or None,
                    sample_weight=_coerce_legacy_string(row.get("sample_weight")) or None,
                    sample_quantity=_coerce_legacy_string(row.get("sample_quantity")) or None,
                    sample_testing_serving=_coerce_legacy_string(row.get("sample_testing_serving")) or None,
                    sample_testing_method=_coerce_legacy_string(row.get("sample_testing_method")) or None,
                    sample_testing_type=_coerce_legacy_string(row.get("sample_testing_type")) or None,
                    requested_by=requested_by,
                    approved_by=approved_by,
                    status=status_value,
                    approved_at=approved_at,
                    rejected_at=rejected_at,
                    completed_at=completed_at,
                    created_at=created_at,
                    updated_at=updated_at,
                )
                instances.append((row_number, instance))
            except ValidationError as exc:
                results.append(
                    {
                        "index": row_number,
                        "status": "error",
                        "message": getattr(exc, "detail", {"detail": "Data tidak valid."}),
                    }
                )

        if instances:
            with transaction.atomic():
                created_instances = [instance for _row_number, instance in instances]
                Pengujian.objects.bulk_create(created_instances)
                for row_number, instance in instances:
                    log_admin_action(
                        self.request.user,
                        instance,
                        ADDITION,
                        "Created sample testing via CSL Admin legacy bulk import.",
                    )
                    results.append(
                        {
                            "index": row_number,
                            "status": "success",
                            "message": "Sukses",
                            "id": str(instance.id),
                        }
                    )
                    success_count += 1

        results.sort(key=lambda item: item.get("index", 0))
        failed_count = len(results) - success_count
        response_status = (
            status.HTTP_201_CREATED
            if failed_count == 0
            else status.HTTP_207_MULTI_STATUS
        )
        return Response(
            {
                "results": results,
                "success_count": success_count,
                "failed_count": failed_count,
            },
            status=response_status,
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        self._ensure_transition(instance, ["Pending"], "Approved")
        actor_profile = getattr(request.user, 'profile', None)
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Approved', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(approved_by=actor_profile, approved_at=now)
        notify_request_status(instance, kind="pengujian", status_value="Approved", actor_profile=actor_profile, request=request)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='all/export')
    def export(self, request):
        if not self._can_manage_sample_testing_approval():
            raise PermissionDenied("Anda tidak memiliki akses untuk export data pengujian sampel.")
        qs = self._apply_export_search(self.get_queryset())
        serializer = PengujianListSerializer(qs, many=True)
        return Response({
            "count": qs.count(),
            "generated_at": timezone.now(),
            "results": serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='all/requesters')
    def requester_options(self, request):
        if not self._can_manage_sample_testing_approval():
            raise PermissionDenied("Anda tidak memiliki akses untuk melihat daftar pemohon pengujian sampel.")
        return build_requester_dropdown_response(super().get_queryset())

    @extend_schema(
        parameters=[
            OpenApiParameter("q", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("status", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("requested_by", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("department", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("created_after", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("created_before", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("document_type", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("ordering", OpenApiTypes.STR, OpenApiParameter.QUERY),
        ]
    )
    @action(detail=False, methods=['get'], url_path='all/documents')
    def all_documents(self, request):
        if not self._can_manage_sample_testing_approval():
            raise PermissionDenied("Anda tidak memiliki akses untuk melihat dokumen pengujian sampel.")

        document_queryset = (
            Document.objects.select_related(
                "uploaded_by__user",
            )
            .all()
        )
        document_queryset = self._apply_document_filters(document_queryset)
        queryset = (
            Pengujian.objects.select_related("requested_by__user")
            .filter(documents__in=document_queryset)
            .distinct()
            .prefetch_related(
                Prefetch(
                    "documents",
                    queryset=document_queryset,
                    to_attr="filtered_documents",
                )
            )
        )
        page = self.paginate_queryset(queryset)
        serializer = AdminPengujianDocumentGroupSerializer(
            page if page is not None else queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response({"results": serializer.data, "count": queryset.count()})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        self._ensure_transition(instance, ["Pending"], "Rejected")
        actor_profile = getattr(request.user, 'profile', None)
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Rejected', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(approved_by=actor_profile, rejected_at=now)
        notify_request_status(instance, kind="pengujian", status_value="Rejected", actor_profile=actor_profile, request=request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        instance = self.get_object()
        self._ensure_requester_cancel_permission(instance)
        self._ensure_transition(instance, ["Approved"], "Canceled")
        serializer = self._transition_serializer(
            instance,
            data={"status": "Canceled", **request.data},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        notify_request_status(
            instance,
            kind="pengujian",
            status_value="Canceled",
            actor_profile=getattr(request.user, "profile", None),
            request=request,
        )
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['post'],
        url_path='documents/upload',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_document(self, request, pk=None):
        instance = self.get_object()
        document_type = str(request.data.get("document_type") or "").strip()
        uploaded_file = request.FILES.get("file")

        if not uploaded_file:
            raise ValidationError({"file": "File dokumen wajib diunggah."})

        allowed_extensions = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp"}
        _, extension = os.path.splitext(uploaded_file.name or "")
        if extension.lower() not in allowed_extensions:
            raise ValidationError(
                {"file": "Format dokumen harus berupa image, PDF, DOC, atau DOCX."}
            )
        if (getattr(uploaded_file, "size", 0) or 0) > PENGUJIAN_DOCUMENT_MAX_SIZE:
            raise ValidationError(
                {"file": "Ukuran dokumen maksimal 5 MB."}
            )

        existing_documents = self._get_existing_document_map(instance)
        self._ensure_document_upload_permission(instance, document_type)
        self._validate_document_upload_sequence(instance, document_type, existing_documents)

        current_profile = self._current_profile()
        document_instance = existing_documents.get(document_type)
        previous_document_name = ""
        previous_document_storage = None
        if document_instance and document_instance.document:
            previous_document_name = document_instance.document.name or ""
            previous_document_storage = document_instance.document.storage

        if document_instance is None:
            document_instance = Document(pengujian=instance, document_type=document_type)

        document_instance.document = uploaded_file
        document_instance.original_name = os.path.basename(uploaded_file.name or "")
        document_instance.mime_type = getattr(uploaded_file, "content_type", "") or ""
        document_instance.size = getattr(uploaded_file, "size", 0) or 0
        document_instance.uploaded_by = current_profile
        document_instance.save()

        if (
            previous_document_name
            and previous_document_storage is not None
            and previous_document_name != document_instance.document.name
        ):
            previous_document_storage.delete(previous_document_name)

        next_status = self._resolve_pengujian_status_after_document_upload(instance, document_type)
        update_fields = []
        now = timezone.now()

        if instance.status != next_status:
            instance.status = next_status
            update_fields.extend(["status", "updated_at"])

        if next_status == "Completed" and instance.completed_at is None:
            instance.completed_at = now
            update_fields.extend(["completed_at", "updated_at"])

        if update_fields:
            instance.save(update_fields=list(dict.fromkeys(update_fields)))

        serializer = self.get_serializer(instance)
        return Response(
            {
                "document": DocumentSerializer(document_instance, context=self.get_serializer_context()).data,
                "pengujian": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        parameters=[
            OpenApiParameter("document_type", OpenApiTypes.STR, OpenApiParameter.PATH),
        ]
    )
    @action(
        detail=True,
        methods=['delete'],
        url_path=r'documents/delete/(?P<document_type>[^/.]+)',
    )
    def delete_document(self, request, pk=None, document_type=None):
        instance = self.get_object()
        document_type = str(document_type or "").strip()

        existing_documents = self._get_existing_document_map(instance)
        self._ensure_document_upload_permission(instance, document_type)
        self._validate_document_upload_sequence(instance, document_type, existing_documents)

        document_instance = existing_documents.get(document_type)
        if document_instance is None:
            raise ValidationError({"document_type": "Dokumen tidak ditemukan."})

        self._delete_document_file(document_instance)
        document_instance.delete()

        serializer = self.get_serializer(instance)
        return Response(
            {
                "deleted_document_type": document_type,
                "pengujian": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        self._ensure_transition(instance, ["Approved", "Diproses"], "Completed")
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Completed', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(completed_at=now)
        return Response(serializer.data)


# endregion


# endregion


# region Notifications
class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_queryset(self):
        profile = getattr(self.request.user, "profile", None)
        if profile is None:
            return Notification.objects.none()
        return Notification.objects.filter(recipient=profile).order_by("-created_at")


# endregion


# region Helpers
def normalize_status_value(value):
    if value is None:
        return value
    raw = str(value).strip()
    if not raw:
        return raw
    return STATUS_VALUE_MAP.get(raw.lower(), raw)


def is_active_status_filter(value):
    if value is None:
        return False
    return str(value).strip().lower() == "active"


def _has_review_value(value):
    return bool(str(value or "").strip())


def _review_issue(label, value):
    return {
        "label": str(label),
        "value": str(value),
    }


def _review_result(*, issues=None, passed_indicators=None, overlap_info=None):
    result = {
        "issues": issues or [],
        "passed_indicators": passed_indicators or [],
    }
    if overlap_info is not None:
        result["overlap_info"] = overlap_info
    return result


def _requires_mentor_approval(instance):
    return (
        str(getattr(instance, "purpose", "") or "").strip() == "Skripsi/TA"
        and getattr(instance, "requester_mentor_profile_id", None) is not None
    )


def _is_assigned_mentor(user, instance):
    profile = getattr(user, "profile", None)
    return (
        profile is not None
        and getattr(instance, "requester_mentor_profile_id", None) == profile.id
    )


def _mentor_review_pending(instance):
    return (
        getattr(instance, "status", None) == "Pending"
        and _requires_mentor_approval(instance)
        and not bool(getattr(instance, "is_approved_by_mentor", False))
    )


def _can_run_final_pic_review(instance):
    return not _requires_mentor_approval(instance) or bool(
        getattr(instance, "is_approved_by_mentor", False)
    )


def _booking_review_result(booking):
    issues = []
    passed_indicators = []
    required_fields_complete = True

    if not _has_review_value(booking.requester_phone):
        required_fields_complete = False
        issues.append(
            _review_issue(
                "Nomor telepon belum diisi",
                "Pemohon belum mengisi nomor telepon yang bisa dihubungi.",
            )
        )
    if str(booking.purpose or "").strip() == "Skripsi/TA" and not _has_review_value(booking.requester_mentor):
        required_fields_complete = False
        issues.append(
            _review_issue(
                "Dosen pembimbing belum diisi",
                "Field dosen pembimbing belum dilengkapi pada pengajuan Skripsi/TA ini.",
            )
        )
    if (booking.attendee_count or 0) > 1 and not _has_review_value(booking.attendee_names):
        required_fields_complete = False
        issues.append(
            _review_issue(
                "Nama peserta belum diisi",
                "Jumlah peserta lebih dari 1, tetapi daftar nama peserta belum dilengkapi.",
            )
        )
    if str(booking.purpose or "").strip() == "Workshop":
        if not _has_review_value(booking.workshop_title):
            required_fields_complete = False
            issues.append(
                _review_issue(
                    "Judul workshop belum diisi",
                    "Pengajuan workshop belum memiliki judul kegiatan.",
                )
            )
        if not _has_review_value(booking.workshop_pic):
            required_fields_complete = False
            issues.append(
                _review_issue(
                    "PIC workshop belum diisi",
                    "Pengajuan workshop belum mencantumkan PIC workshop.",
                )
            )
        if not _has_review_value(booking.workshop_institution):
            required_fields_complete = False
            issues.append(
                _review_issue(
                    "Institusi workshop belum diisi",
                    "Pengajuan workshop belum mencantumkan institusi workshop.",
                )
            )

    _SHARED_PURPOSES = {"Penelitian", "Skripsi/TA"}
    _BLOCKING_PURPOSES = {"Praktikum", "Workshop"}

    current_purpose = str(booking.purpose or "").strip()
    practicum_count = 0
    booking_overlap_ok = True
    overlap_info = None

    if booking.room_id and booking.start_time and booking.end_time:
        practicum_count = Schedule.objects.filter(
            room_id=booking.room_id,
            start_time__lt=booking.end_time,
            end_time__gt=booking.start_time,
        ).count()
        if practicum_count:
            issues.append(
                _review_issue(
                    "Bentrok jadwal praktikum",
                    f"Ruangan sudah dipakai untuk {practicum_count} jadwal praktikum pada rentang waktu ini.",
                )
            )

        overlapping_bookings = (
            Booking.objects.filter(
                room_id=booking.room_id,
                status="Approved",
                start_time__lt=booking.end_time,
                end_time__gt=booking.start_time,
            )
            .exclude(pk=booking.pk)
        )

        if current_purpose in _BLOCKING_PURPOSES:
            # Praktikum/Workshop baru: blocked jika ada overlap apapun
            blocking_count = overlapping_bookings.count()
            if blocking_count:
                booking_overlap_ok = False
                issues.append(
                    _review_issue(
                        "Bentrok booking aktif",
                        f"Pengajuan {current_purpose} tidak dapat dijadwalkan bersamaan dengan booking lain "
                        f"({blocking_count} booking aktif pada rentang waktu ini).",
                    )
                )
        else:
            # Penelitian/Skripsi: blocked jika ada overlap dengan Praktikum/Workshop
            hard_blocking = overlapping_bookings.filter(purpose__in=list(_BLOCKING_PURPOSES))
            hard_blocking_count = hard_blocking.count()
            if hard_blocking_count:
                booking_overlap_ok = False
                issues.append(
                    _review_issue(
                        "Bentrok dengan booking Praktikum/Workshop",
                        f"Ruangan sudah dipakai untuk {hard_blocking_count} booking Praktikum/Workshop "
                        f"yang sudah disetujui pada rentang waktu ini.",
                    )
                )
            else:
                room_capacity = getattr(booking.room, "capacity", None)
                shared_bookings = overlapping_bookings.filter(purpose__in=list(_SHARED_PURPOSES))
                existing_total = shared_bookings.aggregate(
                    total=Sum("attendee_count")
                )["total"] or 0
                current_attendees = booking.attendee_count or 0
                total_attendees = existing_total + current_attendees
                shared_count = shared_bookings.count()

                if room_capacity is not None:
                    overlap_info = {
                        "shared_booking_count": shared_count,
                        "existing_attendees": existing_total,
                        "current_attendees": current_attendees,
                        "total_attendees": total_attendees,
                        "room_capacity": room_capacity,
                    }
                    if total_attendees > room_capacity:
                        booking_overlap_ok = False
                        issues.append(
                            _review_issue(
                                "Melebihi kapasitas ruangan",
                                f"Total peserta ({total_attendees} orang) melebihi kapasitas ruangan "
                                f"({room_capacity} orang) jika digabung dengan booking lain yang sudah disetujui "
                                f"pada rentang waktu ini.",
                            )
                        )
                    elif shared_count > 0:
                        passed_indicators.append(
                            f"Kapasitas ruangan mencukupi "
                            f"({total_attendees}/{room_capacity} peserta dari {shared_count} booking {current_purpose} aktif)"
                        )

    if practicum_count == 0:
        passed_indicators.append("Tidak bentrok dengan jadwal praktikum/workshop pada ruangan yang sama")
    if booking_overlap_ok:
        if overlap_info is not None:
            remaining = overlap_info["room_capacity"] - overlap_info["total_attendees"]
            passed_indicators.append(
                f"Tidak bentrok dengan booking lain yang sudah disetujui "
                f"(sisa slot kapasitas: {remaining} orang)"
            )
        else:
            passed_indicators.append("Tidak bentrok dengan booking lain yang sudah disetujui")
    if required_fields_complete:
        passed_indicators.append("Field penting untuk approval sudah terisi semua")

    # Equipment stock overlap check per item
    if booking.start_time and booking.end_time:
        for item in booking.equipment_items.select_related("equipment").all():
            eq = item.equipment
            if getattr(eq, "is_shareable", False):
                passed_indicators.append(f"{eq.name}: Alat bersifat shareable, tidak ada pembatasan stok berdasarkan waktu")
                continue
            result = _equipment_review_overlap_issues(
                equipment_id=eq.pk,
                requested_quantity=item.quantity,
                stock_quantity=eq.quantity,
                start_time=booking.start_time,
                end_time=booking.end_time,
                exclude_booking_id=booking.pk,
            )
            for issue in result.get("issues", []):
                issues.append(
                    _review_issue(
                        f"Stok alat tidak mencukupi: {eq.name}",
                        issue.get("detail", ""),
                    )
                )
            for indicator in result.get("passed_indicators", []):
                passed_indicators.append(f"{eq.name}: {indicator}")

    return _review_result(issues=issues, passed_indicators=passed_indicators, overlap_info=overlap_info)


def _equipment_review_overlap_issues(
    *,
    equipment_id,
    requested_quantity,
    stock_quantity,
    start_time,
    end_time,
    exclude_borrow_id=None,
    exclude_booking_id=None,
):
    issues = []
    passed_indicators = []
    if not equipment_id or not start_time or not end_time:
        return _review_result(issues=issues, passed_indicators=passed_indicators)

    booking_qs = Booking.objects.filter(
        equipment_items__equipment_id=equipment_id,
        status__in=["Approved"],
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    if exclude_booking_id is not None:
        booking_qs = booking_qs.exclude(pk=exclude_booking_id)
    booking_allocated_qty = booking_qs.aggregate(total=Sum("equipment_items__quantity")).get("total") or 0

    borrow_qs = Borrow.objects.filter(
        equipment_id=equipment_id,
        status__in=["Approved", "Borrowed", "Overdue", "Lost/Damaged"],
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    if exclude_borrow_id is not None:
        borrow_qs = borrow_qs.exclude(pk=exclude_borrow_id)
    borrow_allocated_qty = borrow_qs.aggregate(total=Sum("quantity")).get("total") or 0

    allocated_qty = booking_allocated_qty + borrow_allocated_qty
    remaining_qty = max((stock_quantity or 0) - allocated_qty, 0)

    if requested_quantity > remaining_qty:
        segments = []
        if booking_allocated_qty:
            segments.append(f"{booking_allocated_qty} unit untuk booking")
        if borrow_allocated_qty:
            segments.append(f"{borrow_allocated_qty} unit untuk peminjaman alat")
        issues.append(
            _review_issue(
                "Stok tidak mencukupi pada rentang waktu yang sama",
                (
                    f"Stok total alat {stock_quantity} unit. "
                    f"Sudah teralokasi {allocated_qty} unit"
                    + (f" ({', '.join(segments)})" if segments else "")
                    + f", sehingga sisa stok hanya {remaining_qty} unit untuk rentang waktu ini."
                ),
            )
        )
    else:
        passed_indicators.append("Sisa stok alat pada rentang waktu yang sama masih mencukupi")

    return _review_result(issues=issues, passed_indicators=passed_indicators)


def _borrow_review_result(borrow):
    issues = []
    passed_indicators = []
    required_fields_complete = True

    if not _has_review_value(borrow.requester_phone):
        required_fields_complete = False
        issues.append(
            _review_issue(
                "Nomor telepon belum diisi",
                "Pemohon belum mengisi nomor telepon yang bisa dihubungi.",
            )
        )
    if str(borrow.purpose or "").strip() == "Skripsi/TA" and not _has_review_value(borrow.requester_mentor):
        required_fields_complete = False
        issues.append(
            _review_issue(
                "Dosen pembimbing belum diisi",
                "Field dosen pembimbing belum dilengkapi pada pengajuan Skripsi/TA ini.",
            )
        )

    equipment = getattr(borrow, "equipment", None)
    equipment_available = False
    stock_within_limit = False
    if equipment is not None:
        if str(equipment.status or "") != "Available":
            issues.append(
                _review_issue(
                    "Status alat tidak available",
                    f"Status alat saat ini {equipment.status}. Pastikan alat memang dapat dipinjam sebelum approve.",
                )
            )
        else:
            equipment_available = True
        if (borrow.quantity or 0) > (equipment.quantity or 0):
            issues.append(
                _review_issue(
                    "Jumlah melebihi stok",
                    f"Pengajuan meminta {borrow.quantity} unit, sementara stok alat hanya {equipment.quantity}.",
                )
            )
        else:
            stock_within_limit = True

    if equipment is not None:
        overlap_result = _equipment_review_overlap_issues(
            equipment_id=getattr(borrow, "equipment_id", None),
            requested_quantity=borrow.quantity or 0,
            stock_quantity=getattr(equipment, "quantity", 0),
            start_time=borrow.start_time,
            end_time=borrow.end_time,
            exclude_borrow_id=borrow.pk,
        )
        issues.extend(overlap_result["issues"])
        passed_indicators.extend(overlap_result["passed_indicators"])

    if equipment_available:
        passed_indicators.insert(0, "Status alat masih available")
    if stock_within_limit:
        passed_indicators.append("Jumlah pengajuan tidak melebihi stok alat")
    if required_fields_complete:
        passed_indicators.append("Field penting untuk approval sudah terisi semua")

    return _review_result(issues=issues, passed_indicators=passed_indicators)


def has_staff_management_access(user):
    return (
        user
        and user.is_authenticated
        and (
            getattr(user, "is_superuser", False)
            or has_role(user, STAFF)
            or has_role(user, ADMINISTRATOR)
            or has_role(user, SUPER_ADMINISTRATOR)
        )
    )


def is_reviewer_or_above(user):
    return (
        user
        and user.is_authenticated
        and (
            getattr(user, "is_superuser", False)
            or has_role(user, LECTURER)
            or has_role(user, ADMINISTRATOR)
            or has_role(user, SUPER_ADMINISTRATOR)
        )
    )


def is_administrator_or_above(user):
    return (
        user
        and user.is_authenticated
        and (
            getattr(user, "is_superuser", False)
            or has_role(user, ADMINISTRATOR)
            or has_role(user, SUPER_ADMINISTRATOR)
        )
    )


def can_manage_all_approval_records(user):
    return is_administrator_or_above(user)


def build_requester_dropdown_response(queryset):
    requester_ids = (
        queryset.exclude(requested_by__isnull=True)
        .values_list("requested_by_id", flat=True)
        .distinct()
    )
    profiles = (
        Profile.objects
        .select_related("user")
        .filter(id__in=requester_ids)
        .order_by("full_name", "user__email")
    )
    return Response([
        {
            "id": str(profile.id),
            "full_name": profile.full_name or profile.email,
            "email": profile.email,
            "department": profile.department,
        }
        for profile in profiles
    ])


def _profile_display_name(profile):
    if not profile:
        return None
    return (
        getattr(profile, 'full_name', None)
        or getattr(getattr(profile, 'user', None), 'email', None)
        or str(profile)
    )


def _profile_role(profile):
    if not profile:
        return None
    return getattr(profile, "role", None)


def _event_title_with_requester(base_title, profile):
    requester_name = _profile_display_name(profile)
    if not requester_name:
        return base_title
    return f"{base_title} - {requester_name}"


def _overview_title(value, fallback):
    if value is None:
        return fallback
    raw = str(value).strip()
    return raw or fallback


def _create_notification(recipient, *, title, category, message):
    if recipient is None:
        return None
    return Notification.objects.create(
        recipient=recipient,
        title=title,
        category=category,
        message=message,
    )


def _request_label(kind):
    labels = {
        "booking": "peminjaman lab",
        "borrow": "peminjaman alat",
        "pengujian": "pengujian sampel",
    }
    return labels.get(kind, "request")


def _request_identifier(instance, fallback):
    return (
        getattr(instance, "code", None)
        or getattr(instance, "sample_name", None)
        or getattr(instance, "name", None)
        or fallback
    )


def build_status_aggregates(queryset, completed_statuses=None):
    completed_statuses = completed_statuses or ["Completed"]
    return {
        "total": queryset.count(),
        "pending": queryset.filter(status="Pending").count(),
        "approved": queryset.filter(status="Approved").count(),
        "diproses": queryset.filter(status="Diproses").count(),
        "completed": queryset.filter(status__in=completed_statuses).count(),
        "rejected": queryset.filter(status="Rejected").count(),
        "expired": queryset.filter(status="Expired").count(),
    }


def build_borrow_status_aggregates(queryset):
    return {
        "total": queryset.count(),
        "pending": queryset.filter(status="Pending").count(),
        "approved": queryset.filter(status="Approved").count(),
        "rejected": queryset.filter(status="Rejected").count(),
        "expired": queryset.filter(status="Expired").count(),
        "borrowed": queryset.filter(status="Borrowed").count(),
        "returned_pending_inspection": queryset.filter(
            status="Returned Pending Inspection"
        ).count(),
        "returned": queryset.filter(status="Returned").count(),
        "overdue": queryset.filter(status="Overdue").count(),
        "lost_damaged": queryset.filter(status="Lost/Damaged").count(),
    }


def sync_booking_statuses():
    now = timezone.now()
    expired_pending = (
        Booking.objects
        .filter(status="Pending", end_time__lt=now, expired_at__isnull=True)
        .update(status="Expired", expired_at=now, updated_at=now)
    )
    completed_approved = (
        Booking.objects
        .filter(status="Approved", end_time__lt=now, completed_at__isnull=True)
        .update(status="Completed", completed_at=now, updated_at=now)
    )
    return {
        "expired_pending": expired_pending,
        "completed_approved": completed_approved,
    }


def sync_borrow_statuses():
    now = timezone.now()
    expired_pending = (
        Borrow.objects
        .filter(status="Pending", start_time__lt=now, expired_at__isnull=True)
        .update(status="Expired", expired_at=now, updated_at=now)
    )
    overdue_borrows = list(
        Borrow.objects
        .filter(status="Borrowed", end_time__lt=now, overdue_at__isnull=True)
        .select_related("requested_by", "equipment")
    )
    if overdue_borrows:
        Borrow.objects.filter(pk__in=[item.pk for item in overdue_borrows]).update(
            status="Overdue",
            overdue_at=now,
            updated_at=now,
        )
        for item in overdue_borrows:
            item.status = "Overdue"
            notify_borrow_overdue(item)
    return {
        "expired_pending": expired_pending,
        "marked_overdue": len(overdue_borrows),
    }


BEBAS_LAB_DOCUMENT_TYPES = {"form_alat_kecil", "form_alat_besar", "form_permintaan_bahan"}


class SuratBebasLabViewSet(BulkDeleteMixin, viewsets.ModelViewSet):
    queryset = (
        SuratBebasLab.objects
        .select_related("requested_by__user", "reviewed_by__user")
        .prefetch_related("documents__uploaded_by__user", "booking_histories")
        .order_by("-created_at")
    )
    serializer_class = SuratBebasLabSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    bulk_delete_success_message = "Semua permohonan surat bebas laboratorium terpilih berhasil dihapus."
    bulk_delete_failure_message = "Sebagian permohonan surat bebas laboratorium gagal dihapus."

    def get_serializer_class(self):
        if self.action in {"list", "my", "all"}:
            return SuratBebasLabListSerializer
        return SuratBebasLabSerializer

    def _current_profile(self):
        return getattr(self.request.user, "profile", None)

    def _is_admin(self):
        return is_administrator_or_above(self.request.user)

    def _is_owner(self, instance):
        profile = self._current_profile()
        return profile and instance.requested_by_id == profile.id

    def check_bulk_delete_permission(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Akses ditolak.")

    def _apply_filters(self, qs):
        search = (
            self.request.query_params.get("search")
            or self.request.query_params.get("q")
            or ""
        ).strip()
        status_param = self.request.query_params.get("status")
        requested_by = self.request.query_params.get("requested_by")
        batch = (self.request.query_params.get("batch") or "").strip()
        created_after = self.request.query_params.get("created_after")
        created_before = self.request.query_params.get("created_before")
        ordering = (self.request.query_params.get("ordering") or "").strip().lower()
        if search:
            qs = qs.filter(
                Q(requested_by__full_name__icontains=search)
                | Q(requested_by__user__email__icontains=search)
                | Q(requested_by__id_number__icontains=search)
                | Q(code__icontains=search)
            ).distinct()
        if status_param:
            qs = qs.filter(status=status_param)
        if requested_by:
            qs = qs.filter(requested_by_id=requested_by)
        if batch:
            qs = qs.filter(requested_by__batch__icontains=batch)
        if created_after:
            qs = qs.filter(created_at__gte=created_after)
        if created_before:
            qs = qs.filter(created_at__lte=created_before)
        if ordering == "oldest":
            qs = qs.order_by("created_at", "id")
        else:
            qs = qs.order_by("-created_at", "-id")
        return qs

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "my":
            return self._apply_filters(qs.filter(requested_by=self._current_profile()))
        if self.action == "all":
            if not self._is_admin():
                raise PermissionDenied("Akses ditolak.")
            return self._apply_filters(qs)
        if not self._is_admin():
            return self._apply_filters(qs.filter(requested_by=self._current_profile()))
        return self._apply_filters(qs)

    def perform_create(self, serializer):
        instance = serializer.save(requested_by=self._current_profile())
        self._save_documents(instance)
        self._save_booking_histories(instance)

    def _save_booking_histories(self, instance):
        import json
        raw = self.request.data.get("booking_histories", "")
        if not raw:
            return
        try:
            items = json.loads(raw) if isinstance(raw, str) else raw
        except (ValueError, TypeError):
            raise ValidationError({"booking_histories": "Format tidak valid (harus JSON array)."})
        if not isinstance(items, list):
            return
        for item in items:
            if not isinstance(item, dict):
                continue
            SuratBebasLabBookingHistory.objects.create(
                surat_bebas_lab=instance,
                lab_room_name=str(item.get("lab_room_name", ""))[:255],
                start_date=item.get("start_date"),
                end_date=item.get("end_date"),
            )

    def _save_documents(self, instance):
        request = self.request
        saved = 0
        for doc_type in BEBAS_LAB_DOCUMENT_TYPES:
            file_obj = request.FILES.get(doc_type)
            if not file_obj:
                continue
            self._replace_document(instance, doc_type, file_obj)
            saved += 1
        if saved == 0:
            instance.delete()
            raise ValidationError({"documents": "Minimal satu dokumen harus dilampirkan."})

    def _replace_document(self, instance, document_type, file_obj):
        document_instance = instance.documents.filter(document_type=document_type).first()
        if document_instance is None:
            Document.objects.create(
                surat_bebas_lab=instance,
                document_type=document_type,
                document=file_obj,
                original_name=file_obj.name,
                mime_type=file_obj.content_type,
                size=file_obj.size,
                uploaded_by=self._current_profile(),
                pengujian=None,
            )
            return

        old_document_name = document_instance.document.name if document_instance.document else ""
        document_instance.document = file_obj
        document_instance.original_name = file_obj.name
        document_instance.mime_type = file_obj.content_type
        document_instance.size = file_obj.size
        document_instance.uploaded_by = self._current_profile()
        document_instance.pengujian = None
        document_instance.save()

        if old_document_name and old_document_name != document_instance.document.name:
            document_storage = document_instance.document.storage
            if document_storage is not None:
                document_storage.delete(old_document_name)

    def _delete_document_file(self, document_instance):
        if not document_instance.document:
            return

        document_name = document_instance.document.name or ""
        document_storage = document_instance.document.storage
        if document_name and document_storage is not None:
            document_storage.delete(document_name)

    def _build_mutation_response(self, instance, **extra):
        instance.refresh_from_db()
        serializer = SuratBebasLabSerializer(instance, context=self.get_serializer_context())
        return Response(
            {
                "surat_bebas_lab": serializer.data,
                **extra,
            },
            status=status.HTTP_200_OK,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self._is_owner(instance):
            raise PermissionDenied("Anda hanya dapat mengubah permohonan milik sendiri.")
        if instance.status != "Pending":
            raise ValidationError({"status": "Hanya permohonan berstatus Pending yang dapat diubah."})

        updated_document_types = []
        for document_type in BEBAS_LAB_DOCUMENT_TYPES:
            file_obj = request.FILES.get(document_type)
            if not file_obj:
                continue
            self._replace_document(instance, document_type, file_obj)
            updated_document_types.append(document_type)

        if not updated_document_types:
            raise ValidationError({"documents": "Minimal satu dokumen harus dikirim untuk diperbarui."})

        return self._build_mutation_response(
            instance,
            action="documents_updated",
            updated_document_types=updated_document_types,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        is_admin = self._is_admin()
        if not self._is_owner(instance) and not is_admin:
            raise PermissionDenied("Akses ditolak.")
        if not is_admin and instance.status != "Pending":
            raise ValidationError({"status": "Hanya permohonan berstatus Pending yang dapat dihapus."})
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        documents = list(instance.documents.all())
        super().perform_destroy(instance)
        for document in documents:
            self._delete_document_file(document)

    @extend_schema(
        parameters=[
            OpenApiParameter("document_type", OpenApiTypes.STR, OpenApiParameter.PATH),
        ]
    )
    @action(
        detail=True,
        methods=["delete"],
        url_path=r"documents/delete/(?P<document_type>[^/.]+)",
    )
    def delete_document(self, request, pk=None, document_type=None):  # noqa: ARG002
        instance = self.get_object()
        if not self._is_owner(instance) and not self._is_admin():
            raise PermissionDenied("Akses ditolak.")
        if instance.status != "Pending":
            raise ValidationError({"status": "Hanya dokumen dari permohonan Pending yang dapat dihapus."})

        document_type = str(document_type or "").strip()
        if document_type not in BEBAS_LAB_DOCUMENT_TYPES:
            raise ValidationError({"document_type": "Jenis dokumen tidak dikenali."})

        document_instance = instance.documents.filter(document_type=document_type).first()
        if document_instance is None:
            raise ValidationError({"document_type": "Dokumen tidak ditemukan."})
        if instance.documents.count() <= 1:
            raise ValidationError(
                {"documents": "Minimal satu dokumen harus tersisa pada permohonan."}
            )

        self._delete_document_file(document_instance)
        document_instance.delete()

        return self._build_mutation_response(
            instance,
            action="document_deleted",
            deleted_document_type=document_type,
        )

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, _request):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        serializer = SuratBebasLabListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response({"results": serializer.data, "count": qs.count()})

    @action(detail=False, methods=["get"], url_path="all")
    def all(self, _request):
        if not self._is_admin():
            raise PermissionDenied("Akses ditolak.")
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        serializer = SuratBebasLabListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response({"results": serializer.data, "count": qs.count()})

    @action(detail=False, methods=["get"], url_path="booking-suggestions")
    def booking_suggestions(self, _request):
        profile = self._current_profile()
        if not profile:
            raise PermissionDenied("Profil pengguna tidak ditemukan.")
        qs = (
            Booking.objects
            .filter(
                requested_by=profile,
                status__in=["Approved", "Completed"],
                purpose="Skripsi/TA",
            )
            .select_related("room")
            .order_by("-start_time")
        )
        serializer = BookingSuggestionSerializer(qs, many=True)
        return Response({"results": serializer.data, "count": qs.count()})

    @action(detail=True, methods=["patch"], url_path="update-booking-histories")
    def update_booking_histories(self, request, pk=None):  # noqa: ARG002
        instance = self.get_object()
        if not self._is_owner(instance) and not self._is_admin():
            raise PermissionDenied("Anda hanya dapat mengubah permohonan milik sendiri.")
        if instance.status != "Pending":
            raise ValidationError({"status": "Hanya permohonan berstatus Pending yang dapat diubah."})
        import json
        raw = request.data.get("booking_histories", "")
        try:
            items = json.loads(raw) if isinstance(raw, str) else raw
        except (ValueError, TypeError):
            raise ValidationError({"booking_histories": "Format tidak valid (harus JSON array)."})
        if not isinstance(items, list):
            raise ValidationError({"booking_histories": "booking_histories harus berupa array."})
        instance.booking_histories.all().delete()
        for item in items:
            if not isinstance(item, dict):
                continue
            SuratBebasLabBookingHistory.objects.create(
                surat_bebas_lab=instance,
                lab_room_name=str(item.get("lab_room_name", ""))[:255],
                start_date=item.get("start_date"),
                end_date=item.get("end_date"),
            )
        return self._build_mutation_response(instance, action="booking_histories_updated")

    @action(detail=True, methods=["post"], url_path="send-letter")
    def send_letter(self, request, pk=None):  # noqa: ARG002
        if not self._is_admin():
            raise PermissionDenied("Hanya Admin yang dapat mengirim surat.")
        instance = self.get_object()
        if instance.status != "Approved":
            raise ValidationError({"status": "Surat hanya dapat dikirim untuk permohonan yang sudah disetujui."})

        pdf_file = request.FILES.get("letter_pdf")
        if not pdf_file:
            raise ValidationError({"letter_pdf": "File PDF surat harus dilampirkan."})

        requester = instance.requested_by
        requester_email = (
            requester.user.email if requester and getattr(requester, "user", None) else None
        )
        if not requester_email:
            raise ValidationError({"email": "Email pemohon tidak ditemukan."})

        requester_name = getattr(requester, "full_name", None) or requester_email
        attachment_name = f"surat-bebas-lab-{instance.code}.pdf"
        pdf_bytes = pdf_file.read()

        frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
        cta_url = f"{frontend_url}/lab-clearance" if frontend_url else ""
        context = build_email_context(
            request=request,
            extra_context={
                "notification_title": "Surat Bebas Penggunaan Laboratorium",
                "notification_message": (
                    "Surat bebas penggunaan laboratorium Anda telah diterbitkan dan "
                    f"terlampir pada email ini untuk pengajuan {instance.code}."
                ),
                "user_display": requester_name,
                "request_identifier": instance.code,
                "cta_url": cta_url,
                "cta_label": "Buka Halaman Surat Bebas Lab",
            },
        )

        sent = send_notification_email(
            requester_email,
            template_base="csluse/email/lab_clearance_letter",
            context=context,
            attachments=[(attachment_name, pdf_bytes, "application/pdf")],
        )
        if not sent:
            raise ValidationError({"email": "Gagal mengirim email surat ke pemohon."})

        return Response({"message": f"Surat berhasil dikirim ke {requester_email}."})

    @action(detail=True, methods=["post"])
    def approve(self, _request, pk=None):  # noqa: ARG002
        if not self._is_admin():
            raise PermissionDenied("Hanya Admin yang dapat menyetujui permohonan.")
        instance = self.get_object()
        if instance.status != "Pending":
            raise ValidationError({"status": "Hanya permohonan berstatus Pending yang dapat disetujui."})
        now = timezone.now()
        serializer = SuratBebasLabSerializer(
            instance,
            data={"status": "Approved"},
            partial=True,
            context={**self.get_serializer_context(), "allow_status_transition": True},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(reviewed_by=self._current_profile(), reviewed_at=now)
        return self._build_mutation_response(
            instance,
            action="approved",
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):  # noqa: ARG002
        if not self._is_admin():
            raise PermissionDenied("Hanya Admin yang dapat menolak permohonan.")
        instance = self.get_object()
        if instance.status != "Pending":
            raise ValidationError({"status": "Hanya permohonan berstatus Pending yang dapat ditolak."})
        note = (request.data.get("note") or "").strip()
        now = timezone.now()
        serializer = SuratBebasLabSerializer(
            instance,
            data={"status": "Rejected", "note": note},
            partial=True,
            context={**self.get_serializer_context(), "allow_status_transition": True},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(reviewed_by=self._current_profile(), reviewed_at=now)
        return self._build_mutation_response(
            instance,
            action="rejected",
        )


# endregion
