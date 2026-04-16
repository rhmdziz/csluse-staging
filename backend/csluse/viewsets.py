import os
import re
from datetime import datetime, timedelta
from urllib.parse import urlparse

from django.contrib.admin.models import ADDITION, CHANGE, DELETION
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.db.models import Prefetch, Q, Sum
from rest_framework import viewsets, status
from rest_framework.parsers import MultiPartParser, FormParser
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
    Use,
    Notification,
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
    BorrowListSerializer,
    AnnouncementListSerializer,
    AnnouncementSerializer,
    ScheduleSerializer,
    FAQSerializer,
    CalendarEventSerializer,
    ScheduleFeedItemSerializer,
    PengujianSerializer,
    PengujianListSerializer,
    UseSerializer,
    UseListSerializer,
    DashboardOverviewSerializer,
    NotificationSerializer,
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
from .email_notifications import (
    build_email_context,
    notification_cta_label,
    notification_cta_url,
    send_notification_email,
)

STATUS_VALUE_MAP = {
    "pending": "Pending",
    "approved": "Approved",
    "diproses": "Diproses",
    "menunggu pembayaran": "Menunggu Pembayaran",
    "waiting_payment": "Menunggu Pembayaran",
    "waiting payment": "Menunggu Pembayaran",
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

PENGUJIAN_APPROVER_DOCUMENT_TYPES = {"testing_agreement", "invoice", "test_result_letter"}
PENGUJIAN_REQUESTER_DOCUMENT_TYPES = {
    "signed_testing_agreement",
    "payment_proof",
}
PENGUJIAN_DOCUMENT_MAX_SIZE = 5 * 1024 * 1024
PENGUJIAN_NEXT_DOCUMENT_TYPES = {
    "testing_agreement": "signed_testing_agreement",
    "signed_testing_agreement": "invoice",
    "invoice": "payment_proof",
    "payment_proof": "test_result_letter",
}
ANNOUNCEMENT_IMAGE_SRC_RE = re.compile(
    r"""<img[^>]+src=["'](?P<src>[^"']+)["']""",
    re.IGNORECASE,
)

# region Support Classes
class DefaultPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


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
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsStaffOrAbove()]
        if self.action in {"update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdministratorOrAbove()]
        return super().get_permissions()

    def perform_create(self, serializer):
        uploaded_image = self.request.FILES.get('image')
        name = os.path.basename(uploaded_image.name) if uploaded_image else ''
        instance = serializer.save(
            created_by=getattr(self.request.user, 'profile', None)
            if self.request.user.is_authenticated else None,
            name=name,
        )
        if instance.image and not instance.url:
            instance.url = instance.image.url
            instance.save(update_fields=['url'])


# endregion


# region Inventory
class RoomViewSet(viewsets.ModelViewSet):
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

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data ruangan.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        room_map = {
            str(item.id): item
            for item in Room.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in room_map]
        deleted_ids = []

        for item_id in ids:
            room = room_map.get(str(item_id))
            if room is None:
                continue
            self._delete_room_instance(room)
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
                    "Semua ruangan terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian ruangan tidak ditemukan."
                ),
            },
            status=response_status,
        )

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


class EquipmentViewSet(viewsets.ModelViewSet):
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
        if self.action in {"update", "partial_update", "destroy", "bulk_delete"}:
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


        # Filter params: status, category, room, pic, is_moveable, created range
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

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data peralatan.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        equipment_map = {
            str(item.id): item
            for item in Equipment.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in equipment_map]
        deleted_ids = []

        for item_id in ids:
            equipment = equipment_map.get(str(item_id))
            if equipment is None:
                continue
            self._delete_equipment_instance(equipment)
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
                    "Semua peralatan terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian peralatan tidak ditemukan."
                ),
            },
            status=response_status,
        )

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


class MaterialViewSet(viewsets.ModelViewSet):
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

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data bahan.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        material_map = {
            str(item.id): item
            for item in Material.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in material_map]
        deleted_ids = []

        for item_id in ids:
            material = material_map.get(str(item_id))
            if material is None:
                continue
            self._delete_material_instance(material)
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
                    "Semua bahan terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian bahan tidak ditemukan."
                ),
            },
            status=response_status,
        )

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


class SoftwareViewSet(viewsets.ModelViewSet):
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

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data software.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        software_map = {
            str(item.id): item
            for item in Software.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in software_map]
        deleted_ids = []

        for item_id in ids:
            software = software_map.get(str(item_id))
            if software is None:
                continue
            self._delete_software_instance(software)
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
                    "Semua software terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian software tidak ditemukan."
                ),
            },
            status=response_status,
        )

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = SoftwareListSerializer(queryset, many=True)
        return Response(serializer.data)


# endregion


# region Booking Rooms
class BookingViewSet(viewsets.ModelViewSet):
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
        _notify_request_status(
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
        department = self.request.query_params.get('department')
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
        if department:
            qs = qs.filter(requested_by__department__iexact=department)
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
        serializer.save(requested_by=getattr(self.request.user, 'profile', None))

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self._ensure_requester_mutation_permission(instance)
        self._delete_booking_instance(instance)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not self._can_access_booking_approval_scope():
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data booking.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        booking_map = {
            str(item.id): item
            for item in Booking.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in booking_map]
        deleted_ids = []

        for item_id in ids:
            booking = booking_map.get(str(item_id))
            if booking is None:
                continue
            self._delete_booking_instance(booking)
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
                    "Semua record peminjaman lab terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian record peminjaman lab tidak ditemukan."
                ),
            },
            status=response_status,
        )

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
        _notify_request_status(instance, kind="booking", status_value="Approved", actor_profile=actor_profile, request=request)
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
        _notify_request_status(instance, kind="booking", status_value="Rejected", actor_profile=actor_profile, request=request)
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


# endregion

# region Borrow Equipment
class BorrowViewSet(viewsets.ModelViewSet):
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

    def _handle_mentor_approval(self, borrow, actor_profile):
        borrow.is_approved_by_mentor = True
        borrow.mentor_approved_at = timezone.now()
        borrow.save(update_fields=[
            "is_approved_by_mentor",
            "mentor_approved_at",
            "updated_at",
        ])
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
        _notify_request_status(
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
        department = self.request.query_params.get('department')
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
        if department:
            qs = qs.filter(requested_by__department__iexact=department)
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
        serializer.save(requested_by=getattr(self.request.user, 'profile', None))

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
        self._ensure_requester_mutation_permission(instance)
        self._delete_borrow_instance(instance)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not self._can_manage_all_borrows():
            raise PermissionDenied("Hanya laboran/admin yang dapat menghapus record borrow.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        borrow_map = {
            str(item.id): item
            for item in Borrow.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in borrow_map]
        deleted_ids = []

        for item_id in ids:
            borrow = borrow_map.get(str(item_id))
            if borrow is None:
                continue
            self._delete_borrow_instance(borrow)
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
                    "Semua record peminjaman alat terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian record peminjaman alat tidak ditemukan."
                ),
            },
            status=response_status,
        )

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
        _notify_request_status(instance, kind="borrow", status_value="Approved", actor_profile=actor_profile, request=request)
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
        _notify_request_status(instance, kind="borrow", status_value="Rejected", actor_profile=actor_profile, request=request)
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
class AnnouncementViewSet(viewsets.ModelViewSet):
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

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus pengumuman.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        announcement_map = {
            str(item.id): item
            for item in Announcement.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in announcement_map]
        deleted_ids = []

        for item_id in ids:
            announcement = announcement_map.get(str(item_id))
            if announcement is None:
                continue
            self._delete_announcement_instance(announcement)
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
                    "Semua pengumuman terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian pengumuman berhasil dihapus."
                ),
            },
            status=response_status,
        )


# endregion


# region Scheduling And Overview
class ScheduleViewSet(viewsets.ModelViewSet):
    queryset = Schedule.objects.select_related('room', 'created_by').order_by('start_time')
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
        instance = serializer.save(created_by=getattr(self.request.user, 'profile', None))
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
        created_by = getattr(self.request.user, 'profile', None)

        for index, row in enumerate(rows, start=1):
            row_number = row.get("index", index) if isinstance(row, dict) else index
            serializer = self.get_serializer(data=row)
            if serializer.is_valid():
                instance = serializer.save(created_by=created_by)
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

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not has_staff_management_access(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus jadwal.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        schedule_map = {
            str(item.id): item
            for item in Schedule.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in schedule_map]
        deleted_ids = []

        for item_id in ids:
            schedule = schedule_map.get(str(item_id))
            if schedule is None:
                continue
            self.perform_destroy(schedule)
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
                    "Semua jadwal terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian jadwal berhasil dihapus."
                ),
            },
            status=response_status,
        )

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
            .select_related('room', 'created_by', 'created_by__user')
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
            .select_related('room', 'created_by')
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
        sync_use_statuses()
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
            uses = list(
                Use.objects
                .filter(equipment__room__pics__id=profile.id)
                .select_related("equipment", "equipment__room", "requested_by")
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
            uses = list(
                Use.objects
                .filter(requested_by=profile)
                .select_related("equipment", "equipment__room")
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

        for item in uses:
            if item.status == "Approved" and item.start_time and item.start_time >= now:
                upcoming_items.append({
                    "id": f"use-{item.id}",
                    "title": _overview_title(getattr(getattr(item, "equipment", None), "name", None), item.code or "Penggunaan Alat"),
                    "type": "Penggunaan Alat",
                    "requester_name": _profile_display_name(getattr(item, "requested_by", None)) or "",
                    "start_time": item.start_time,
                    "end_time": item.end_time,
                    "href": f"/use-equipment/approval/{item.id}" if is_pic_scope_role else f"/use-equipment/{item.id}",
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

        for item in uses:
            recent_activities.append({
                "id": f"use-{item.id}",
                "title": _overview_title(getattr(getattr(item, "equipment", None), "name", None), item.code or "Penggunaan Alat"),
                "code": item.code or "",
                "type": "Penggunaan Alat",
                "status": item.status,
                "created_at": item.created_at,
                "href": f"/use-equipment/approval/{item.id}" if is_pic_scope_role else f"/use-equipment/{item.id}",
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
                "total_requests": len(bookings) + len(uses) + len(borrows) + len(pengujians),
                "pending": (
                    status_count(bookings, "Pending")
                    + status_count(uses, "Pending")
                    + status_count(borrows, "Pending")
                    + status_count(pengujians, "Pending")
                ),
                "approved": (
                    status_count(bookings, "Approved")
                    + status_count(uses, "Approved")
                    + status_count(borrows, "Approved")
                    + status_count(
                        pengujians,
                        "Approved",
                        "Diproses",
                        "Menunggu Pembayaran",
                    )
                ),
                "completed": (
                    status_count(bookings, "Completed")
                    + status_count(uses, "Completed")
                    + status_count(borrows, "Returned")
                    + status_count(pengujians, "Completed")
                ),
                "rejected": (
                    status_count(bookings, "Rejected")
                    + status_count(uses, "Rejected")
                    + status_count(borrows, "Rejected")
                    + status_count(pengujians, "Rejected")
                ),
                "expired": (
                    status_count(bookings, "Expired")
                    + status_count(uses, "Expired")
                ),
            },
            "upcoming_approved": upcoming_approved,
            "recent_activities": recent_activities[:6],
        }

        serializer = DashboardOverviewSerializer(payload)
        return Response(serializer.data)


# endregion


# region FAQ
class FAQViewSet(viewsets.ModelViewSet):
    queryset = FAQ.objects.select_related('created_by').order_by('-created_at')
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
        instance = serializer.save(created_by=getattr(self.request.user, 'profile', None))
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

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not is_administrator_or_above(request.user):
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus FAQ.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        faq_map = {
            str(item.id): item
            for item in FAQ.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in faq_map]
        deleted_ids = []

        for item_id in ids:
            faq = faq_map.get(str(item_id))
            if faq is None:
                continue
            self._delete_faq_instance(faq)
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
                    "Semua FAQ terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian FAQ berhasil dihapus."
                ),
            },
            status=response_status,
        )


# endregion


# region Sample Testing
class PengujianViewSet(viewsets.ModelViewSet):
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
        if pengujian.status in {"Pending", "Rejected", "Completed"}:
            raise ValidationError(
                {"status": "Dokumen hanya dapat diunggah setelah pengajuan disetujui dan sebelum selesai."}
            )

        required_types = {
            "signed_testing_agreement": ["testing_agreement"],
            "invoice": ["signed_testing_agreement"],
            "payment_proof": ["invoice"],
            "test_result_letter": ["payment_proof"],
        }.get(document_type, [])

        missing_types = [
            required_type
            for required_type in required_types
            if required_type not in existing_documents
        ]
        if missing_types:
            raise ValidationError(
                {
                    "document_type": (
                        "Dokumen sebelumnya belum tersedia untuk tahap ini."
                    )
                }
            )

        next_document_type = PENGUJIAN_NEXT_DOCUMENT_TYPES.get(document_type)
        if (
            document_type in existing_documents
            and next_document_type
            and next_document_type in existing_documents
        ):
            raise ValidationError(
                {
                    "document_type": (
                        "Dokumen ini tidak dapat diganti karena tahap berikutnya sudah memiliki dokumen."
                    )
                }
            )

    def _resolve_pengujian_status_after_document_upload(self, pengujian, document_type):
        if document_type == "invoice":
            return "Menunggu Pembayaran"
        if document_type == "test_result_letter":
            return "Completed"
        if pengujian.status == "Approved":
            return "Diproses"
        return pengujian.status

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
        serializer.save(requested_by=getattr(self.request.user, 'profile', None))

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_requester_mutation_permission(instance)
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self._ensure_requester_mutation_permission(instance)
        self._delete_pengujian_instance(instance)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not self._can_manage_sample_testing_approval():
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data pengujian sampel.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        pengujian_map = {
            str(item.id): item
            for item in Pengujian.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in pengujian_map]
        deleted_ids = []

        for item_id in ids:
            pengujian = pengujian_map.get(str(item_id))
            if pengujian is None:
                continue
            self._delete_pengujian_instance(pengujian)
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
                    "Semua record pengujian sampel terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian record pengujian sampel tidak ditemukan."
                ),
            },
            status=response_status,
        )

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
        _notify_request_status(instance, kind="pengujian", status_value="Approved", actor_profile=actor_profile, request=request)
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
        _notify_request_status(instance, kind="pengujian", status_value="Rejected", actor_profile=actor_profile, request=request)
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

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        self._ensure_transition(instance, ["Approved", "Diproses", "Menunggu Pembayaran"], "Completed")
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Completed', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(completed_at=now)
        return Response(serializer.data)


# endregion


# region Use Equipment
class UseViewSet(viewsets.ModelViewSet):
    queryset = (
        Use.objects
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
    serializer_class = UseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_serializer_class(self):
        if self.action == "list":
            return UseListSerializer
        return UseSerializer

    def _auto_update_use_statuses(self):
        sync_use_statuses()

    def _append_aggregates(self, response, aggregates):
        response.data["aggregates"] = aggregates
        return response

    def _delete_use_instance(self, instance):
        log_admin_action(
            self.request.user,
            instance,
            DELETION,
            "Deleted equipment usage record via CSL Admin.",
        )
        instance.delete()

    def _can_access_use_approval_scope(self):
        return is_reviewer_or_above(self.request.user)

    def _can_manage_all_uses(self):
        return can_manage_all_approval_records(self.request.user)

    def _current_profile(self):
        return getattr(self.request.user, "profile", None)

    def _is_room_pic_for_use(self, use_item):
        profile = self._current_profile()
        room = getattr(getattr(use_item, "equipment", None), "room", None)
        if not profile or room is None:
            return False
        return room.pics.filter(id=profile.id).exists()

    def _is_use_mentor(self, use_item):
        return _is_assigned_mentor(self.request.user, use_item)

    def _can_review_use(self, use_item):
        return (
            self._can_manage_all_uses()
            or self._is_room_pic_for_use(use_item)
            or self._is_use_mentor(use_item)
        )

    def _can_finalize_use_review(self, use_item):
        return self._can_manage_all_uses() or self._is_room_pic_for_use(use_item)

    def _ensure_use_access(self, use_item):
        current_profile = self._current_profile()
        if current_profile and use_item.requested_by_id == current_profile.id:
            return
        if self._can_review_use(use_item):
            return
        raise PermissionDenied("Anda tidak memiliki akses ke pengajuan penggunaan alat ini.")

    def _ensure_requester_mutation_permission(self, use_item):
        current_profile = self._current_profile()
        if current_profile is None or use_item.requested_by_id != current_profile.id:
            raise PermissionDenied(
                "Anda hanya dapat mengubah atau menghapus pengajuan penggunaan alat milik sendiri."
            )
        if use_item.status != "Pending":
            raise ValidationError(
                {
                    "status": (
                        "Hanya pengajuan penggunaan alat dengan status Pending yang dapat diubah atau dihapus."
                    )
                }
            )

    def _ensure_review_permission(self, use_item):
        if not self._can_review_use(use_item):
            raise PermissionDenied(
                "Hanya PIC ruangan alat terkait atau Admin yang dapat memproses penggunaan alat."
            )

        current_profile = self._current_profile()
        if (
            current_profile
            and use_item.requested_by_id == current_profile.id
            and not is_administrator_or_above(self.request.user)
        ):
            raise PermissionDenied(
                "Anda tidak dapat memproses pengajuan milik sendiri kecuali sebagai Admin atau SuperAdministrator."
            )

    def _handle_mentor_approval(self, use_item, actor_profile):
        use_item.is_approved_by_mentor = True
        use_item.mentor_approved_at = timezone.now()
        use_item.save(update_fields=[
            "is_approved_by_mentor",
            "mentor_approved_at",
            "updated_at",
        ])
        serializer = self.get_serializer(use_item)
        return Response(serializer.data)

    def _handle_mentor_rejection(self, use_item, actor_profile, request):
        serializer = self._transition_serializer(
            use_item,
            data={"status": "Rejected", **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(rejected_at=now)
        _notify_request_status(
            use_item,
            kind="use",
            status_value="Rejected",
            actor_profile=actor_profile,
            request=request,
        )
        return Response(serializer.data)

    def _ensure_transition(self, use_item, allowed_sources, target_status):
        if use_item.status not in allowed_sources:
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

    def _apply_list_filters(self, qs, *, allow_requester_filter=False):
        query = (self.request.query_params.get('q') or '').strip()
        status_param = self.request.query_params.get('status')
        equipment_id = self.request.query_params.get('equipment')
        room_id = self.request.query_params.get('room')
        requester_id = self.request.query_params.get('requested_by')
        department = self.request.query_params.get('department')
        approved_by = self.request.query_params.get('approved_by')
        start_after = self.request.query_params.get('start_after')
        end_before = self.request.query_params.get('end_before')
        created_after = self.request.query_params.get('created_after')
        created_before = self.request.query_params.get('created_before')

        if query:
            qs = qs.filter(
                Q(code__icontains=query)
                | Q(equipment__name__icontains=query)
                | Q(equipment__room__name__icontains=query)
                | Q(requested_by__full_name__icontains=query)
                | Q(requested_by__user__email__icontains=query)
                | Q(purpose__icontains=query)
            ).distinct()
        if status_param:
            qs = qs.filter(status=normalize_status_value(status_param))
        if equipment_id:
            qs = qs.filter(equipment_id=equipment_id)
        if room_id:
            qs = qs.filter(equipment__room_id=room_id)
        if requester_id and allow_requester_filter:
            qs = qs.filter(requested_by_id=requester_id)
        if department:
            qs = qs.filter(requested_by__department__iexact=department)
        if approved_by:
            qs = qs.filter(approved_by_id=approved_by)
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
            OpenApiParameter("department", OpenApiTypes.STR, OpenApiParameter.QUERY),
            OpenApiParameter("approved_by", OpenApiTypes.UUID, OpenApiParameter.QUERY),
            OpenApiParameter("start_after", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("end_before", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("created_after", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
            OpenApiParameter("created_before", OpenApiTypes.DATETIME, OpenApiParameter.QUERY),
        ]
    )
    def list(self, request, *args, **kwargs):
        self._auto_update_use_statuses()
        aggregate_qs = self.get_queryset()
        aggregates = build_status_aggregates(aggregate_qs)

        queryset = self.filter_queryset(aggregate_qs)
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    def get_queryset(self):
        self._auto_update_use_statuses()
        qs = super().get_queryset()
        profile = self._current_profile()
        if self.action == "my":
            qs = qs.filter(requested_by=profile)
            return self._apply_list_filters(qs, allow_requester_filter=False)

        if not self._can_access_use_approval_scope():
            qs = qs.filter(requested_by=profile)
            return self._apply_list_filters(qs, allow_requester_filter=False)

        if profile is None:
            return qs.none()

        # Admin: bypass filter PIC untuk action detail/aksi (retrieve, approve, dll)
        # atau jika halaman admin mengirim ?unscoped=1.
        _USE_LIST_ACTIONS = {'list', 'all', 'export', 'requester_options'}
        if self._can_manage_all_uses() and (
            self.request.query_params.get('unscoped') == '1'
            or self.action not in _USE_LIST_ACTIONS
        ):
            return self._apply_list_filters(qs, allow_requester_filter=True)

        # Semua reviewer (termasuk admin di dashboard): hanya PIC/mentor.
        qs = qs.filter(
            Q(equipment__room__pics__id=profile.id)
            | Q(requester_mentor_profile_id=profile.id)
        ).distinct()
        return self._apply_list_filters(qs, allow_requester_filter=False)

    def _apply_export_search(self, qs):
        query = (self.request.query_params.get('q') or '').strip()
        if not query:
            return qs
        return qs.filter(
            Q(code__icontains=query)
            | Q(equipment__name__icontains=query)
            | Q(equipment__room__name__icontains=query)
            | Q(requested_by__full_name__icontains=query)
            | Q(requested_by__user__email__icontains=query)
            | Q(purpose__icontains=query)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(requested_by=getattr(self.request.user, 'profile', None))

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_use_access(instance)
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
        self._ensure_requester_mutation_permission(instance)
        self._delete_use_instance(instance)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        if not self._can_access_use_approval_scope():
            raise PermissionDenied("Anda tidak memiliki akses untuk menghapus data penggunaan alat.")

        serializer = RecordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]

        use_map = {
            str(item.id): item
            for item in Use.objects.filter(id__in=ids)
        }
        missing_ids = [str(item_id) for item_id in ids if str(item_id) not in use_map]
        deleted_ids = []

        for item_id in ids:
            use_item = use_map.get(str(item_id))
            if use_item is None:
                continue
            self._delete_use_instance(use_item)
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
                    "Semua record penggunaan alat terpilih berhasil dihapus."
                    if not missing_ids
                    else "Sebagian record penggunaan alat tidak ditemukan."
                ),
            },
            status=response_status,
        )

    @action(detail=False, methods=['get'], url_path='my')
    def my(self, request):
        self._auto_update_use_statuses()
        base_qs = super().get_queryset().filter(
            requested_by=getattr(request.user, "profile", None)
        )
        aggregates = build_status_aggregates(base_qs)
        qs = self._apply_list_filters(base_qs, allow_requester_filter=False)
        page = self.paginate_queryset(qs)
        serializer = UseListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=['get'], url_path='all')
    def all(self, request):
        if not self._can_access_use_approval_scope():
            raise PermissionDenied("Anda tidak memiliki akses untuk melihat seluruh data penggunaan alat.")

        self._auto_update_use_statuses()
        base_qs = self.get_queryset()
        aggregates = build_status_aggregates(base_qs)
        qs = base_qs
        page = self.paginate_queryset(qs)
        serializer = UseListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self._append_aggregates(self.get_paginated_response(serializer.data), aggregates)
        return Response({"results": serializer.data, "aggregates": aggregates})

    @action(detail=False, methods=['get'], url_path='all/export')
    def export(self, request):
        if not self._can_access_use_approval_scope():
            raise PermissionDenied("Anda tidak memiliki akses untuk export data penggunaan alat.")

        self._auto_update_use_statuses()
        qs = self._apply_export_search(self.get_queryset())
        serializer = UseListSerializer(qs, many=True)
        return Response({
            "count": qs.count(),
            "generated_at": timezone.now(),
            "results": serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='all/requesters')
    def requester_options(self, request):
        if not self._can_access_use_approval_scope():
            raise PermissionDenied("Anda tidak memiliki akses untuk melihat daftar pemohon penggunaan alat.")
        self._auto_update_use_statuses()
        return build_requester_dropdown_response(self.get_queryset())

    @action(detail=True, methods=['get'], url_path='review-check')
    def review_check(self, request, pk=None):
        instance = self.get_object()
        self._ensure_use_access(instance)
        return Response(_use_review_result(instance))

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        actor_profile = getattr(request.user, 'profile', None)
        if _mentor_review_pending(instance):
            if not self._is_use_mentor(instance):
                raise ValidationError(
                    {"detail": "Pengajuan ini masih menunggu persetujuan dosen pembimbing."}
                )
            return self._handle_mentor_approval(instance, actor_profile)

        if not _can_run_final_pic_review(instance):
            raise ValidationError(
                {"detail": "Pengajuan ini masih menunggu persetujuan dosen pembimbing."}
            )
        if not self._can_finalize_use_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan alat terkait atau Admin yang dapat memberikan persetujuan akhir."
            )
        self._ensure_transition(instance, ["Pending"], "Approved")
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Approved', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(approved_by=actor_profile, approved_at=now)
        _notify_request_status(instance, kind="use", status_value="Approved", actor_profile=actor_profile, request=request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        actor_profile = getattr(request.user, 'profile', None)
        if _mentor_review_pending(instance):
            if not self._is_use_mentor(instance):
                raise ValidationError(
                    {"detail": "Pengajuan ini masih menunggu persetujuan dosen pembimbing."}
                )
            return self._handle_mentor_rejection(instance, actor_profile, request)

        if not self._can_finalize_use_review(instance):
            raise PermissionDenied(
                "Hanya PIC ruangan alat terkait atau Admin yang dapat memberikan keputusan akhir."
            )
        self._ensure_transition(instance, ["Pending"], "Rejected")
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Rejected', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(approved_by=actor_profile, rejected_at=now)
        _notify_request_status(instance, kind="use", status_value="Rejected", actor_profile=actor_profile, request=request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        instance = self.get_object()
        self._ensure_review_permission(instance)
        self._ensure_transition(instance, ["Approved"], "Completed")
        serializer = self._transition_serializer(
            instance,
            data={'status': 'Completed', **request.data},
        )
        serializer.is_valid(raise_exception=True)
        now = timezone.now()
        serializer.save(completed_at=now)
        return Response(serializer.data)


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
                # Cek kapasitas: total attendee_count semua booking Penelitian/Skripsi yang overlap + ini
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
    exclude_use_id=None,
    exclude_booking_id=None,
):
    issues = []
    passed_indicators = []
    if not equipment_id or not start_time or not end_time:
        return _review_result(issues=issues, passed_indicators=passed_indicators)

    booking_qs = Booking.objects.filter(
        equipment_items__equipment_id=equipment_id,
        status__in=["Pending", "Approved"],
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    if exclude_booking_id is not None:
        booking_qs = booking_qs.exclude(pk=exclude_booking_id)
    booking_allocated_qty = booking_qs.aggregate(total=Sum("equipment_items__quantity")).get("total") or 0

    borrow_qs = Borrow.objects.filter(
        equipment_id=equipment_id,
        status__in=["Pending", "Approved", "Borrowed", "Overdue", "Lost/Damaged"],
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    if exclude_borrow_id is not None:
        borrow_qs = borrow_qs.exclude(pk=exclude_borrow_id)
    borrow_allocated_qty = borrow_qs.aggregate(total=Sum("quantity")).get("total") or 0

    use_qs = Use.objects.filter(
        equipment_id=equipment_id,
        status__in=["Pending", "Approved"],
        start_time__lt=end_time,
        end_time__gt=start_time,
    )
    if exclude_use_id is not None:
        use_qs = use_qs.exclude(pk=exclude_use_id)
    use_allocated_qty = use_qs.aggregate(total=Sum("quantity")).get("total") or 0

    allocated_qty = booking_allocated_qty + borrow_allocated_qty + use_allocated_qty
    remaining_qty = max((stock_quantity or 0) - allocated_qty, 0)

    if requested_quantity > remaining_qty:
        segments = []
        if booking_allocated_qty:
            segments.append(f"{booking_allocated_qty} unit untuk booking")
        if use_allocated_qty:
            segments.append(f"{use_allocated_qty} unit untuk penggunaan alat")
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


def _use_review_result(use_item):
    issues = []
    passed_indicators = []
    required_fields_complete = True

    if not _has_review_value(use_item.requester_phone):
        required_fields_complete = False
        issues.append(
            _review_issue(
                "Nomor telepon belum diisi",
                "Pemohon belum mengisi nomor telepon yang bisa dihubungi.",
            )
        )
    if str(use_item.purpose or "").strip() == "Skripsi/TA" and not _has_review_value(use_item.requester_mentor):
        required_fields_complete = False
        issues.append(
            _review_issue(
                "Dosen pembimbing belum diisi",
                "Field dosen pembimbing belum dilengkapi pada pengajuan Skripsi/TA ini.",
            )
        )

    equipment = getattr(use_item, "equipment", None)
    equipment_available = False
    stock_within_limit = False
    if equipment is not None:
        if str(equipment.status or "") != "Available":
            issues.append(
                _review_issue(
                    "Status alat tidak available",
                    f"Status alat saat ini {equipment.status}. Pastikan alat memang dapat digunakan sebelum approve.",
                )
            )
        else:
            equipment_available = True
        if (use_item.quantity or 0) > (equipment.quantity or 0):
            issues.append(
                _review_issue(
                    "Jumlah melebihi stok",
                    f"Pengajuan meminta {use_item.quantity} unit, sementara stok alat hanya {equipment.quantity}.",
                )
            )
        else:
            stock_within_limit = True

    if equipment is not None and not getattr(equipment, "is_shareable", False):
        overlap_result = _equipment_review_overlap_issues(
            equipment_id=getattr(use_item, "equipment_id", None),
            requested_quantity=use_item.quantity or 0,
            stock_quantity=getattr(equipment, "quantity", 0),
            start_time=use_item.start_time,
            end_time=use_item.end_time,
            exclude_use_id=use_item.pk,
        )
        issues.extend(overlap_result["issues"])
        passed_indicators.extend(overlap_result["passed_indicators"])
    elif equipment is not None and getattr(equipment, "is_shareable", False):
        passed_indicators.append("Alat bersifat shareable, tidak ada pembatasan stok berdasarkan waktu")

    if equipment_available:
        passed_indicators.insert(0, "Status alat masih available")
    if stock_within_limit:
        passed_indicators.append("Jumlah pengajuan tidak melebihi stok alat")
    if required_fields_complete:
        passed_indicators.append("Field penting untuk approval sudah terisi semua")

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

    if equipment is not None and not getattr(equipment, "is_shareable", False):
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
    elif equipment is not None and getattr(equipment, "is_shareable", False):
        passed_indicators.append("Alat bersifat shareable, tidak ada pembatasan stok berdasarkan waktu")

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
            "full_name": profile.full_name or profile.user.email,
            "email": profile.user.email,
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
        "use": "penggunaan alat",
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


def _notification_recipient_email(recipient):
    if recipient is None:
        return None
    user = getattr(recipient, "user", None)
    email = getattr(user, "email", None)
    return (email or "").strip() or None


def _notification_recipient_name(instance, recipient):
    return (
        _profile_display_name(recipient)
        or getattr(instance, "name", None)
        or _notification_recipient_email(recipient)
        or "Pengguna"
    )


def _notification_email_extra_context(
    instance,
    *,
    recipient,
    kind,
    title,
    message,
    cta_url,
    cta_label,
):
    return {
        "user_display": _notification_recipient_name(instance, recipient),
        "notification_title": title,
        "notification_message": message,
        "request_label": _request_label(kind).title(),
        "request_label_lower": _request_label(kind),
        "request_identifier": _request_identifier(instance, _request_label(kind).title()),
        "cta_url": cta_url,
        "cta_label": cta_label,
    }


def _send_request_status_email(
    instance,
    *,
    recipient,
    kind,
    title,
    message,
    status_value,
    request=None,
):
    recipient_email = _notification_recipient_email(recipient)
    if not recipient_email:
        return

    cta_url = notification_cta_url(kind, instance)
    cta_label = notification_cta_label(kind)
    context = build_email_context(
        request=request,
        extra_context={
            **_notification_email_extra_context(
                instance,
                recipient=recipient,
                kind=kind,
                title=title,
                message=message,
                cta_url=cta_url,
                cta_label=cta_label,
            ),
            "status_label": "disetujui" if status_value == "Approved" else "ditolak",
        },
    )
    send_notification_email(
        recipient_email,
        template_base="csluse/email/request_status",
        context=context,
    )


def _send_borrow_overdue_email(
    instance,
    *,
    recipient,
    title,
    message,
    due_text,
    equipment_name,
    request=None,
):
    recipient_email = _notification_recipient_email(recipient)
    if not recipient_email:
        return

    cta_url = notification_cta_url("borrow", instance)
    context = build_email_context(
        request=request,
        extra_context={
            **_notification_email_extra_context(
                instance,
                recipient=recipient,
                kind="borrow",
                title=title,
                message=message,
                cta_url=cta_url,
                cta_label="Lihat Detail Peminjaman",
            ),
            "equipment_name": equipment_name,
            "due_text": due_text,
        },
    )
    send_notification_email(
        recipient_email,
        template_base="csluse/email/borrow_overdue",
        context=context,
    )


def _notify_request_status(instance, *, kind, status_value, actor_profile=None, request=None):
    recipient = getattr(instance, "requested_by", None)
    if recipient is None:
        return

    request_label = _request_label(kind)
    request_identifier = _request_identifier(instance, request_label.title())
    actor_name = _profile_display_name(actor_profile) or "tim laboratorium"
    category = "Approved" if status_value == "Approved" else "Rejected"
    action_label = "disetujui" if status_value == "Approved" else "ditolak"
    title = f"{request_label.title()} {request_identifier} {action_label}"
    message = (
        f"Pengajuan {request_label} Anda ({request_identifier}) telah "
        f"{action_label} oleh {actor_name}."
    )

    _create_notification(
        recipient,
        title=title,
        category=category,
        message=message,
    )
    _send_request_status_email(
        instance,
        recipient=recipient,
        kind=kind,
        title=title,
        message=message,
        status_value=status_value,
        request=request,
    )


def _notify_borrow_overdue(instance, request=None):
    recipient = getattr(instance, "requested_by", None)
    if recipient is None:
        return

    borrow_identifier = _request_identifier(instance, "Borrow")
    equipment_name = getattr(getattr(instance, "equipment", None), "name", "alat")
    due_at = getattr(instance, "end_time", None)
    due_text = timezone.localtime(due_at).strftime("%d %b %Y %H:%M WIB") if due_at else "jadwal pengembalian"
    title = f"Peminjaman {borrow_identifier} melewati batas waktu"
    message = (
        f"Peminjaman alat Anda ({borrow_identifier}) untuk {equipment_name} "
        f"sudah overdue sejak {due_text}. Segera lakukan pengembalian."
    )

    _create_notification(
        recipient,
        title=title,
        category="Reminder",
        message=message,
    )
    _send_borrow_overdue_email(
        instance,
        recipient=recipient,
        title=title,
        message=message,
        due_text=due_text,
        equipment_name=equipment_name,
        request=request,
    )


def build_status_aggregates(queryset, completed_statuses=None):
    completed_statuses = completed_statuses or ["Completed"]
    return {
        "total": queryset.count(),
        "pending": queryset.filter(status="Pending").count(),
        "approved": queryset.filter(status="Approved").count(),
        "diproses": queryset.filter(status="Diproses").count(),
        "menunggu_pembayaran": queryset.filter(status="Menunggu Pembayaran").count(),
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


def sync_use_statuses():
    now = timezone.now()
    expired_finished = (
        Use.objects
        .filter(status="Pending", end_time__lt=now, expired_at__isnull=True)
        .update(status="Expired", expired_at=now, updated_at=now)
    )
    expired_started_without_end = (
        Use.objects
        .filter(status="Pending", end_time__isnull=True, start_time__lt=now, expired_at__isnull=True)
        .update(status="Expired", expired_at=now, updated_at=now)
    )
    return {
        "expired_finished": expired_finished,
        "expired_started_without_end": expired_started_without_end,
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
            _notify_borrow_overdue(item)
    return {
        "expired_pending": expired_pending,
        "marked_overdue": len(overdue_borrows),
    }


# endregion
