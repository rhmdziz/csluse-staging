import re
from calendar import monthrange
from datetime import timedelta
from typing import Optional

from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from csluse_auth.models import Profile
from csluse_auth.serializers import ProfileSerializer, RoomPicDetailSerializer

from .models import (
    Announcement,
    Booking,
    BookingEquipmentItem,
    Borrow,
    Document,
    Equipment,
    FAQ,
    Image,
    Material,
    Notification,
    Pengujian,
    Room,
    Schedule,
    Software,
    SuratBebasLab,
    SuratBebasLabBookingHistory,
)


# region Shared Media And Document Serializers


class RoomPicListSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomPicDetailSerializer.Meta.model
        fields = [
            "id",
            "full_name",
        ]


class ImageSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(write_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = Image
        fields = [
            "id",
            "image",
            "name",
            "url",
        ]
        read_only_fields = [
            "id",
            "name",
            "url",
        ]

    def get_url(self, obj) -> Optional[str]:
        if obj.url:
            return obj.url
        return obj.image.url if obj.image else None


class DocumentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    document_label = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "document_type",
            "document_label",
            "original_name",
            "mime_type",
            "size",
            "url",
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_url(self, obj) -> Optional[str]:
        return obj.document.url if obj.document else None

    def get_uploaded_by_name(self, obj) -> str:
        if obj.uploaded_by:
            return obj.uploaded_by.full_name or obj.uploaded_by.user.email
        return "-"

    def get_document_label(self, obj) -> str:
        return obj.get_document_type_display()


class AdminDocumentListSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    document_label = serializers.SerializerMethodField()
    pengujian_id = serializers.SerializerMethodField()
    pengujian_code = serializers.SerializerMethodField()
    pengujian_status = serializers.SerializerMethodField()
    institution = serializers.SerializerMethodField()
    requester_id = serializers.SerializerMethodField()
    requester_name = serializers.SerializerMethodField()
    requester_department = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "document_type",
            "document_label",
            "original_name",
            "mime_type",
            "size",
            "url",
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
            "updated_at",
            "pengujian_id",
            "pengujian_code",
            "pengujian_status",
            "institution",
            "requester_id",
            "requester_name",
            "requester_department",
        ]
        read_only_fields = fields

    def get_url(self, obj) -> Optional[str]:
        return obj.document.url if obj.document else None

    def get_uploaded_by_name(self, obj) -> str:
        if obj.uploaded_by:
            return obj.uploaded_by.full_name or obj.uploaded_by.user.email
        return "-"

    def get_document_label(self, obj) -> str:
        return obj.get_document_type_display()

    def get_pengujian_id(self, obj):
        return getattr(obj.pengujian, "id", None)

    def get_pengujian_code(self, obj) -> str:
        return getattr(obj.pengujian, "code", "-")

    def get_pengujian_status(self, obj) -> str:
        return getattr(obj.pengujian, "status", "-")

    def get_institution(self, obj) -> str:
        return getattr(obj.pengujian, "institution", "-")

    def get_requester_id(self, obj):
        requested_by = getattr(obj.pengujian, "requested_by", None)
        return getattr(requested_by, "id", None)

    def get_requester_name(self, obj) -> str:
        requested_by = getattr(obj.pengujian, "requested_by", None)
        if requested_by:
            return requested_by.full_name or requested_by.user.email
        return "-"

    def get_requester_department(self, obj) -> str:
        requested_by = getattr(obj.pengujian, "requested_by", None)
        return getattr(requested_by, "department", "-") or "-"


class AdminPengujianDocumentGroupSerializer(serializers.ModelSerializer):
    requester_id = serializers.SerializerMethodField()
    requester_name = serializers.SerializerMethodField()
    requester_department = serializers.SerializerMethodField()
    institution = serializers.SerializerMethodField()
    pengujian_id = serializers.SerializerMethodField()
    pengujian_code = serializers.SerializerMethodField()
    pengujian_status = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()

    class Meta:
        model = Pengujian
        fields = [
            "pengujian_id",
            "pengujian_code",
            "pengujian_status",
            "institution",
            "requester_id",
            "requester_name",
            "requester_department",
            "documents",
        ]
        read_only_fields = fields

    def get_pengujian_id(self, obj):
        return getattr(obj, "id", None)

    def get_pengujian_code(self, obj) -> str:
        return getattr(obj, "code", "-")

    def get_pengujian_status(self, obj) -> str:
        return getattr(obj, "status", "-")

    def get_institution(self, obj) -> str:
        return getattr(obj, "institution", "-")

    def get_requester_id(self, obj):
        requested_by = getattr(obj, "requested_by", None)
        return getattr(requested_by, "id", None)

    def get_requester_name(self, obj) -> str:
        requested_by = getattr(obj, "requested_by", None)
        if requested_by:
            return requested_by.full_name or requested_by.user.email
        return "-"

    def get_requester_department(self, obj) -> str:
        requested_by = getattr(obj, "requested_by", None)
        return getattr(requested_by, "department", "-") or "-"

    def get_documents(self, obj):
        documents = getattr(obj, "filtered_documents", None)
        if documents is None:
            documents = obj.documents.all()
        return DocumentSerializer(documents, many=True, context=self.context).data


# endregion Shared Media And Document Serializers


# region Inventory Serializers


class RoomSerializer(serializers.ModelSerializer):
    pics = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Profile.objects.all(),
        required=False,
    )
    pics_detail = RoomPicDetailSerializer(source="pics", many=True, read_only=True)

    def validate_pics(self, value):
        allowed_roles = {"LECTURER", "ADMIN"}
        invalid_profiles = [
            profile.full_name or getattr(profile.user, "email", str(profile))
            for profile in value
            if str(profile.role or "").upper() not in allowed_roles
        ]
        if invalid_profiles:
            raise serializers.ValidationError(
                "PIC harus user dengan role Lecturer atau Admin."
            )
        return value

    class Meta:
        model = Room
        fields = [
            "id",
            "name",
            "capacity",
            "description",
            "number",
            "floor",
            "pics",
            "pics_detail",
        ]


class RoomListSerializer(serializers.ModelSerializer):
    pics_detail = RoomPicListSerializer(source="pics", many=True, read_only=True)

    class Meta:
        model = Room
        fields = [
            "id",
            "name",
            "capacity",
            "description",
            "number",
            "floor",
            "pics",
            "pics_detail",
        ]


class RoomDropdownSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = [
            "id",
            "name",
            "number",
            "capacity",
        ]


class EquipmentSerializer(serializers.ModelSerializer):
    room_detail = RoomSerializer(source="room", read_only=True)

    class Meta:
        model = Equipment
        fields = [
            "id",
            "name",
            "description",
            "quantity",
            "status",
            "category",
            "room",
            "room_detail",
            "is_moveable",
            "is_shareable",
            "is_borrowable",
        ]


class EquipmentRoomListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = [
            "id",
            "name",
            "number",
        ]


class EquipmentListSerializer(serializers.ModelSerializer):
    room_detail = EquipmentRoomListSerializer(source="room", read_only=True)

    class Meta:
        model = Equipment
        fields = [
            "id",
            "name",
            "description",
            "quantity",
            "status",
            "category",
            "room",
            "room_detail",
            "is_moveable",
            "is_shareable",
            "is_borrowable",
        ]


class EquipmentDropdownSerializer(serializers.ModelSerializer):
    room_detail = EquipmentRoomListSerializer(source="room", read_only=True)

    class Meta:
        model = Equipment
        fields = [
            "id",
            "name",
            "quantity",
            "room_detail",
            "is_borrowable",
        ]


class MaterialSerializer(serializers.ModelSerializer):
    room_detail = RoomSerializer(source="room", read_only=True)

    class Meta:
        model = Material
        fields = [
            "id",
            "name",
            "description",
            "quantity",
            "unit",
            "status",
            "category",
            "room",
            "room_detail",
        ]


class MaterialRoomListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = [
            "id",
            "name",
            "number",
        ]


class MaterialListSerializer(serializers.ModelSerializer):
    room_detail = MaterialRoomListSerializer(source="room", read_only=True)

    class Meta:
        model = Material
        fields = [
            "id",
            "name",
            "description",
            "quantity",
            "unit",
            "status",
            "category",
            "room",
            "room_detail",
        ]


class MaterialDropdownSerializer(serializers.ModelSerializer):
    room_detail = MaterialRoomListSerializer(source="room", read_only=True)

    class Meta:
        model = Material
        fields = [
            "id",
            "name",
            "quantity",
            "unit",
            "room_detail",
        ]


class SoftwareEquipmentListSerializer(serializers.ModelSerializer):
    room_detail = EquipmentRoomListSerializer(source="room", read_only=True)

    class Meta:
        model = Equipment
        fields = [
            "id",
            "name",
            "room_detail",
        ]


class SoftwareSerializer(serializers.ModelSerializer):
    equipment_detail = SoftwareEquipmentListSerializer(
        source="equipment",
        read_only=True,
    )
    license_expiration = serializers.DateField(
        allow_null=True, required=False
    )

    def to_internal_value(self, data):
        if isinstance(data, dict) and data.get("license_expiration") == "":
            data = {**data, "license_expiration": None}
        return super().to_internal_value(data)

    class Meta:
        model = Software
        fields = [
            "id",
            "name",
            "description",
            "version",
            "license_info",
            "license_expiration",
            "equipment",
            "equipment_detail",
        ]


class SoftwareListSerializer(serializers.ModelSerializer):
    equipment_detail = SoftwareEquipmentListSerializer(
        source="equipment",
        read_only=True,
    )

    class Meta:
        model = Software
        fields = [
            "id",
            "name",
            "description",
            "version",
            "license_info",
            "license_expiration",
            "equipment",
            "equipment_detail",
        ]


# endregion Inventory Serializers


# region Reference Serializers


class RecordProfileListSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = ProfileSerializer.Meta.model
        fields = [
            "id",
            "full_name",
            "email",
            "role",
            "department",
        ]


class RecordRoomListSerializer(serializers.ModelSerializer):
    pics_detail = RoomPicListSerializer(source="pics", many=True, read_only=True)

    class Meta:
        model = Room
        fields = [
            "id",
            "name",
            "number",
            "capacity",
            "pics_detail",
        ]


class RecordEquipmentListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = [
            "id",
            "name",
        ]


class RecordEquipmentWithRoomSerializer(serializers.ModelSerializer):
    room_detail = RecordRoomListSerializer(source="room", read_only=True)

    class Meta:
        model = Equipment
        fields = [
            "id",
            "name",
            "room_detail",
        ]


class RecordBulkDeleteSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        error_messages={
            "empty": "Pilih minimal satu record untuk dihapus.",
        },
    )

    def validate_ids(self, value):
        unique_ids = list(dict.fromkeys(value))
        if len(unique_ids) != len(value):
            raise serializers.ValidationError("Terdapat ID record yang duplikat.")
        return unique_ids


class BulkSetBooleanSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        error_messages={
            "empty": "Pilih minimal satu record.",
        },
    )
    value = serializers.BooleanField()

    def validate_ids(self, value):
        unique_ids = list(dict.fromkeys(value))
        if len(unique_ids) != len(value):
            raise serializers.ValidationError("Terdapat ID record yang duplikat.")
        return unique_ids


# endregion Reference Serializers


# region Notification Serializers


class NotificationSerializer(serializers.ModelSerializer):
    target_path = serializers.SerializerMethodField()

    def _extract_identifier(self, value: str) -> Optional[str]:
        match = re.search(r"\b(?:PR|PA|US|PS)\d{4}-\d{3}\b", value or "")
        if match:
            return match.group(0)
        return None

    def get_target_path(self, obj):
        title = str(getattr(obj, "title", "") or "")
        message = str(getattr(obj, "message", "") or "")
        combined = f"{title} {message}"
        identifier = self._extract_identifier(combined)
        lower_text = combined.lower()

        if "pengujian" in lower_text:
            return "/sample-testing"

        if not identifier:
            return None

        booking = Booking.objects.filter(code=identifier).values_list("id", flat=True).first()
        if booking is not None:
            return f"/booking-rooms/{booking}"

        borrow = Borrow.objects.filter(code=identifier).values_list("id", flat=True).first()
        if borrow is not None:
            return f"/borrow-equipment/{borrow}"

        pengujian = Pengujian.objects.filter(code=identifier).values_list("id", flat=True).first()
        if pengujian is not None:
            return "/sample-testing"

        return None

    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "category",
            "message",
            "target_path",
            "created_at",
            "updated_at",
        ]

# endregion Notification Serializers


# region Booking Serializers


# region Booking Supporting Serializers


class BookingEquipmentItemWriteSerializer(serializers.Serializer):
    equipment = serializers.PrimaryKeyRelatedField(queryset=Equipment.objects.all())
    quantity = serializers.IntegerField(min_value=1)


class BookingEquipmentItemDetailSerializer(serializers.ModelSerializer):
    equipment_detail = RecordEquipmentListSerializer(source="equipment", read_only=True)

    class Meta:
        model = BookingEquipmentItem
        fields = [
            "id",
            "quantity",
            "equipment",
            "equipment_detail",
        ]


# endregion Booking Supporting Serializers


# region Booking Main Serializers


def _add_calendar_months(value, months):
    if value is None:
        return None

    target_month_index = (value.month - 1) + months
    year = value.year + (target_month_index // 12)
    month = (target_month_index % 12) + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


class BookingSerializer(serializers.ModelSerializer):
    requested_by_detail = ProfileSerializer(source="requested_by", read_only=True)
    approved_by_detail = ProfileSerializer(source="approved_by", read_only=True)
    requester_mentor_profile = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.filter(role__iexact="Lecturer", is_mentor=True),
        required=False,
        allow_null=True,
    )
    requester_mentor_profile_detail = ProfileSerializer(
        source="requester_mentor_profile",
        read_only=True,
    )
    room_detail = RoomSerializer(source="room", read_only=True)
    equipment_items = BookingEquipmentItemWriteSerializer(many=True, required=False)
    equipment_items_detail = BookingEquipmentItemDetailSerializer(
        source="equipment_items",
        many=True,
        read_only=True,
    )

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        equipment_items = attrs.get("equipment_items")
        room = attrs.get("room") or getattr(instance, "room", None)
        attendee_count = attrs.get("attendee_count", getattr(instance, "attendee_count", 1))
        start_time = attrs.get("start_time", getattr(instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(instance, "end_time", None))
        next_status = attrs.get("status", getattr(instance, "status", "Pending"))
        rejection_note = attrs.get("rejection_note", getattr(instance, "rejection_note", None))

        attrs = _apply_requester_mentor_rules(self, attrs)

        if instance is None:
            if attrs.get("status") not in (None, "Pending"):
                raise serializers.ValidationError(
                    {"status": "Status booking hanya boleh di-set melalui action endpoint khusus."}
                )
            if attrs.get("approved_by") is not None:
                raise serializers.ValidationError(
                    {"approved_by": "approved_by tidak boleh diisi saat create."}
                )
        else:
            if "status" in attrs:
                if not self.context.get("allow_status_transition"):
                    raise serializers.ValidationError(
                        {"status": "Gunakan action status booking yang spesifik untuk mengubah status."}
                    )
                allowed_next_status = self.context.get("allowed_next_status")
                if allowed_next_status and attrs["status"] != allowed_next_status:
                    raise serializers.ValidationError(
                        {"status": f"Transisi status hanya boleh menuju {allowed_next_status}."}
                    )

            if "approved_by" in attrs:
                raise serializers.ValidationError(
                    {"approved_by": "approved_by tidak boleh diubah langsung."}
                )
            current_purpose = attrs.get("purpose") or (instance.purpose if instance else None)
            if not self.context.get("allow_mentor_transition"):
                if "is_approved_by_mentor" in attrs:
                    if current_purpose == "Skripsi/TA":
                        raise serializers.ValidationError(
                            {"is_approved_by_mentor": "Status approval dosen pembimbing tidak boleh diubah langsung."}
                        )
                    else:
                        attrs.pop("is_approved_by_mentor")
                if "mentor_approved_at" in attrs:
                    if current_purpose == "Skripsi/TA":
                        raise serializers.ValidationError(
                            {"mentor_approved_at": "mentor_approved_at tidak boleh diubah langsung."}
                        )
                    else:
                        attrs.pop("mentor_approved_at")

            if instance.status != "Pending" and not self.context.get("allow_status_transition"):
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            "Booking yang sudah diproses tidak dapat diubah langsung."
                        ]
                    }
                )

        if attendee_count <= 0:
            raise serializers.ValidationError({"attendee_count": "Jumlah orang harus lebih dari 0."})

        if next_status == "Rejected" and not str(rejection_note or "").strip():
            raise serializers.ValidationError(
                {"rejection_note": "Alasan penolakan wajib diisi."}
            )

        if room and attendee_count > room.capacity:
            raise serializers.ValidationError(
                {
                    "attendee_count": (
                        f"Jumlah orang tidak boleh melebihi kapasitas ruangan "
                        f"({room.capacity} orang)."
                    )
                }
            )

        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError(
                {"end_time": "Waktu selesai harus lebih besar dari waktu mulai."}
            )

        if start_time and not self.context.get("allow_status_transition"):
            local_start = timezone.localtime(start_time)
            earliest_start_date = timezone.localdate() + timedelta(days=2)
            if local_start.date() < earliest_start_date:
                raise serializers.ValidationError(
                    {
                        "start_time": (
                            "Waktu mulai booking minimal H+2 dari tanggal pengajuan (pengajuan dilakukan H-2)."
                        )
                    }
                )

        if start_time and end_time and not self.context.get("allow_status_transition"):
            local_start = timezone.localtime(start_time)
            local_end = timezone.localtime(end_time)
            max_end_time = _add_calendar_months(local_start, 3)
            if max_end_time and local_end > max_end_time:
                raise serializers.ValidationError(
                    {
                        "end_time": (
                            "Rentang booking maksimal 3 bulan dari waktu mulai."
                        )
                    }
                )

        if room and start_time and end_time and next_status in {"Pending", "Approved"}:
            if next_status == "Approved" and end_time <= timezone.now():
                raise serializers.ValidationError(
                    {
                        "non_field_errors": [
                            "Booking ini sudah melewati waktu yang diminta dan tidak dapat disetujui."
                        ]
                    }
                )

            EXCLUSIVE_PURPOSES = {"Praktikum", "Workshop"}

            current_purpose = attrs.get("purpose") or (instance.purpose if instance else None)

            if not self.context.get("allow_status_transition"):
                overlapping_schedules = Schedule.objects.filter(
                    room=room,
                    start_time__lt=end_time,
                    end_time__gt=start_time,
                )
                if overlapping_schedules.exists():
                    raise serializers.ValidationError(
                        {
                            "non_field_errors": [
                                "Ruangan sudah memiliki jadwal praktikum pada rentang waktu tersebut."
                            ]
                        }
                    )

            overlapping_approved = Booking.objects.filter(
                room=room,
                status="Approved",
                start_time__lt=end_time,
                end_time__gt=start_time,
            )
            if instance:
                overlapping_approved = overlapping_approved.exclude(pk=instance.pk)

            if overlapping_approved.exists():
                if overlapping_approved.filter(purpose__in=EXCLUSIVE_PURPOSES).exists():
                    raise serializers.ValidationError(
                        {
                            "non_field_errors": [
                                "Ruangan sudah memiliki booking Praktikum/Workshop yang disetujui pada rentang waktu tersebut."
                            ]
                        }
                    )

                if current_purpose in EXCLUSIVE_PURPOSES:
                    raise serializers.ValidationError(
                        {
                            "non_field_errors": [
                                "Ruangan sudah memiliki booking yang disetujui pada rentang waktu tersebut."
                            ]
                        }
                    )

                # Both current and existing are Penelitian/Skripsi/TA — check combined capacity
                total_approved = overlapping_approved.aggregate(
                    total=Sum("attendee_count")
                )["total"] or 0
                if total_approved + attendee_count > room.capacity:
                    raise serializers.ValidationError(
                        {
                            "non_field_errors": [
                                f"Total peserta melebihi kapasitas ruangan ({room.capacity} orang) "
                                f"jika digabung dengan booking lain yang sudah disetujui pada waktu yang sama."
                            ]
                        }
                    )

        if equipment_items is None:
            return attrs

        if not room:
            raise serializers.ValidationError({"room": "Ruangan wajib dipilih terlebih dahulu."})

        seen_equipment_ids = set()
        for item in equipment_items:
            equipment = item["equipment"]
            quantity = item["quantity"]

            if equipment.id in seen_equipment_ids:
                raise serializers.ValidationError(
                    {"equipment_items": "Peralatan yang sama tidak boleh dipilih lebih dari sekali."}
                )
            seen_equipment_ids.add(equipment.id)

            if equipment.room_id != room.id:
                raise serializers.ValidationError(
                    {"equipment_items": f"{equipment.name} harus berasal dari ruangan {room.name}."}
                )

            if quantity > equipment.quantity:
                raise serializers.ValidationError(
                    {"equipment_items": f"Jumlah {equipment.name} melebihi stok tersedia ({equipment.quantity})."}
                )

            # Time-overlap stock check: account for concurrent booking/borrow allocations
            if start_time and end_time and not equipment.is_shareable:
                booking_allocated = (
                    Booking.objects.filter(
                        equipment_items__equipment_id=equipment.id,
                        status__in=["Approved"],
                        start_time__lt=end_time,
                        end_time__gt=start_time,
                    )
                    .exclude(pk=instance.pk if instance else None)
                    .aggregate(total=Sum("equipment_items__quantity"))["total"] or 0
                )
                borrow_allocated = (
                    Borrow.objects.filter(
                        equipment_id=equipment.id,
                        status__in=["Approved", "Borrowed", "Overdue", "Lost/Damaged"],
                        start_time__lt=end_time,
                        end_time__gt=start_time,
                    )
                    .aggregate(total=Sum("quantity"))["total"] or 0
                )
                allocated = booking_allocated + borrow_allocated
                remaining = max(equipment.quantity - allocated, 0)
                if quantity > remaining:
                    raise serializers.ValidationError(
                        {
                            "equipment_items": (
                                f"Stok {equipment.name} tidak mencukupi pada rentang waktu yang dipilih. "
                                f"Stok total {equipment.quantity}, sudah teralokasi {allocated} unit "
                                f"(sisa {remaining} unit)."
                            )
                        }
                    )

        return attrs

    def create(self, validated_data):
        equipment_items = validated_data.pop("equipment_items", [])
        booking = Booking.objects.create(**validated_data)
        self._save_equipment_items(booking, equipment_items)
        return booking

    def update(self, instance, validated_data):
        equipment_items = validated_data.pop("equipment_items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if equipment_items is not None:
            instance.equipment_items.all().delete()
            self._save_equipment_items(instance, equipment_items)

        return instance

    def _save_equipment_items(self, booking, equipment_items):
        for item in equipment_items:
            BookingEquipmentItem.objects.create(
                booking=booking,
                equipment=item["equipment"],
                quantity=item["quantity"],
            )

    class Meta:
        model = Booking
        fields = [
            "id",
            "code",
            "requested_by",
            "requested_by_detail",
            "requester_name",
            "room",
            "room_name",
            "room_detail",
            "start_time",
            "end_time",
            "attendee_count",
            "attendee_names",
            "requester_name",
            "room_name",
            "requester_phone",
            "requester_mentor",
            "requester_mentor_profile",
            "requester_mentor_profile_detail",
            "is_approved_by_mentor",
            "mentor_approved_at",
            "institution",
            "institution_address",
            "workshop_title",
            "workshop_pic",
            "workshop_institution",
            "purpose",
            "note",
            "status",
            "approved_by",
            "approved_by_detail",
            "approved_at",
            "rejected_at",
            "rejection_note",
            "expired_at",
            "completed_at",
            "equipment_items",
            "equipment_items_detail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "requested_by",
            "code",
            "approved_by",
            "approved_at",
            "rejected_at",
            "expired_at",
            "completed_at",
            "is_approved_by_mentor",
            "mentor_approved_at",
        ]


# endregion Booking Main Serializers


# region Booking List Serializers


class BookingListSerializer(serializers.ModelSerializer):
    requested_by_detail = RecordProfileListSerializer(source="requested_by", read_only=True)
    approved_by_detail = RecordProfileListSerializer(source="approved_by", read_only=True)
    requester_mentor_profile_detail = RecordProfileListSerializer(
        source="requester_mentor_profile",
        read_only=True,
    )
    room_detail = RecordRoomListSerializer(source="room", read_only=True)
    equipment_items_detail = BookingEquipmentItemDetailSerializer(
        source="equipment_items",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Booking
        fields = [
            "id",
            "code",
            "start_time",
            "end_time",
            "attendee_count",
            "attendee_names",
            "requester_name",
            "room_name",
            "requester_phone",
            "requester_mentor",
            "requester_mentor_profile_detail",
            "is_approved_by_mentor",
            "mentor_approved_at",
            "institution",
            "institution_address",
            "workshop_title",
            "workshop_pic",
            "workshop_institution",
            "purpose",
            "note",
            "status",
            "requested_by_detail",
            "approved_by_detail",
            "approved_at",
            "rejected_at",
            "rejection_note",
            "expired_at",
            "completed_at",
            "room_detail",
            "equipment_items_detail",
            "created_at",
            "updated_at",
        ]


class BookingUserListSerializer(serializers.ModelSerializer):
    requested_by_detail = RecordProfileListSerializer(source="requested_by", read_only=True)
    requester_mentor_profile_detail = RecordProfileListSerializer(
        source="requester_mentor_profile",
        read_only=True,
    )
    room_detail = RecordRoomListSerializer(source="room", read_only=True)
    equipment_items_detail = BookingEquipmentItemDetailSerializer(
        source="equipment_items",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Booking
        fields = [
            "id",
            "code",
            "start_time",
            "end_time",
            "attendee_count",
            "attendee_names",
            "requester_phone",
            "requester_mentor",
            "requester_mentor_profile_detail",
            "is_approved_by_mentor",
            "mentor_approved_at",
            "institution",
            "institution_address",
            "workshop_title",
            "workshop_pic",
            "workshop_institution",
            "purpose",
            "status",
            "requested_by_detail",
            "approved_at",
            "rejected_at",
            "rejection_note",
            "expired_at",
            "completed_at",
            "room_detail",
            "equipment_items_detail",
            "created_at",
            "updated_at",
        ]


# endregion Booking List Serializers


# endregion Booking Serializers


# region Borrow Serializers


# region Borrow Main Serializers


class BorrowSerializer(serializers.ModelSerializer):
    requested_by_detail = ProfileSerializer(source="requested_by", read_only=True)
    approved_by_detail = ProfileSerializer(source="approved_by", read_only=True)
    requester_mentor_profile = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.filter(role__iexact="Lecturer", is_mentor=True),
        required=False,
        allow_null=True,
    )
    requester_mentor_profile_detail = ProfileSerializer(
        source="requester_mentor_profile",
        read_only=True,
    )
    equipment_detail = EquipmentSerializer(source="equipment", read_only=True)

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        start_time = attrs.get("start_time", getattr(instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(instance, "end_time", None))
        rejection_note = attrs.get("rejection_note", getattr(instance, "rejection_note", None))
        attrs = _apply_requester_mentor_rules(self, attrs)

        if end_time is None:
            raise serializers.ValidationError({"end_time": "Waktu selesai peminjaman wajib diisi."})

        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError(
                {"end_time": "Waktu selesai peminjaman harus setelah waktu mulai."}
            )

        if start_time and not self.context.get("allow_status_transition"):
            local_start = timezone.localtime(start_time)
            earliest_start_date = timezone.localdate() + timedelta(days=2)
            if local_start.date() < earliest_start_date:
                raise serializers.ValidationError(
                    {
                        "start_time": (
                            "Waktu mulai borrow minimal H+2 dari tanggal pengajuan (pengajuan dilakukan H-2)."
                        )
                    }
                )

        if start_time and end_time and not self.context.get("allow_status_transition"):
            local_start = timezone.localtime(start_time)
            local_end = timezone.localtime(end_time)
            max_end_time = _add_calendar_months(local_start, 3)
            if max_end_time and local_end > max_end_time:
                raise serializers.ValidationError(
                    {
                        "end_time": (
                            "Rentang borrow maksimal 3 bulan dari waktu mulai."
                        )
                    }
                )

        if instance is None:
            equipment = attrs.get("equipment")
            if equipment is not None and not equipment.is_borrowable:
                raise serializers.ValidationError(
                    {"equipment": "Peralatan ini tidak tersedia untuk dipinjam."}
                )
            if attrs.get("status") not in (None, "Pending"):
                raise serializers.ValidationError(
                    {"status": "Status borrow hanya boleh di-set melalui action endpoint khusus."}
                )
            if attrs.get("approved_by") is not None:
                raise serializers.ValidationError(
                    {"approved_by": "approved_by tidak boleh diisi saat create."}
                )
            if attrs.get("end_time_actual") is not None:
                raise serializers.ValidationError(
                    {"end_time_actual": "end_time_actual hanya boleh diisi melalui action endpoint khusus."}
                )
            if attrs.get("inspection_note") is not None:
                raise serializers.ValidationError(
                    {"inspection_note": "inspection_note hanya boleh diisi melalui action endpoint inspeksi."}
                )
        else:
            if "status" in attrs:
                if not self.context.get("allow_status_transition"):
                    raise serializers.ValidationError(
                        {"status": "Gunakan action status borrow yang spesifik untuk mengubah status."}
                    )
                allowed_next_status = self.context.get("allowed_next_status")
                if allowed_next_status and attrs["status"] != allowed_next_status:
                    raise serializers.ValidationError(
                        {"status": f"Transisi status hanya boleh menuju {allowed_next_status}."}
                    )

            if "end_time_actual" in attrs and not self.context.get("allow_end_time_actual"):
                raise serializers.ValidationError(
                    {"end_time_actual": "Gunakan action penerimaan pengembalian untuk mengisi end_time_actual."}
                )

            if "approved_by" in attrs:
                raise serializers.ValidationError(
                    {"approved_by": "approved_by tidak boleh diubah langsung."}
                )
            current_purpose = attrs.get("purpose") or (instance.purpose if instance else None)
            if not self.context.get("allow_mentor_transition"):
                if "is_approved_by_mentor" in attrs:
                    if current_purpose == "Skripsi/TA":
                        raise serializers.ValidationError(
                            {"is_approved_by_mentor": "Status approval dosen pembimbing tidak boleh diubah langsung."}
                        )
                    else:
                        attrs.pop("is_approved_by_mentor")
                if "mentor_approved_at" in attrs:
                    if current_purpose == "Skripsi/TA":
                        raise serializers.ValidationError(
                            {"mentor_approved_at": "mentor_approved_at tidak boleh diubah langsung."}
                        )
                    else:
                        attrs.pop("mentor_approved_at")

            if "inspection_note" in attrs:
                raise serializers.ValidationError(
                    {"inspection_note": "Gunakan action inspeksi borrow untuk mengisi inspection_note."}
                )

            if (
                attrs.get("status", getattr(instance, "status", "Pending")) == "Rejected"
                and not str(rejection_note or "").strip()
            ):
                raise serializers.ValidationError(
                    {"rejection_note": "Alasan penolakan wajib diisi."}
                )

        equipment = attrs.get("equipment") or getattr(instance, "equipment", None)
        quantity = attrs.get("quantity", getattr(instance, "quantity", 0))
        if equipment is not None and start_time and end_time:
            if quantity > equipment.quantity:
                raise serializers.ValidationError(
                    {"quantity": f"Jumlah melebihi stok tersedia ({equipment.quantity})."}
                )
            booking_allocated = (
                Booking.objects.filter(
                    equipment_items__equipment_id=equipment.id,
                    status__in=["Approved"],
                    start_time__lt=end_time,
                    end_time__gt=start_time,
                ).aggregate(total=Sum("equipment_items__quantity"))["total"] or 0
            )
            borrow_allocated = (
                Borrow.objects.filter(
                    equipment_id=equipment.id,
                    status__in=["Approved", "Borrowed", "Overdue", "Lost/Damaged"],
                    start_time__lt=end_time,
                    end_time__gt=start_time,
                ).exclude(pk=instance.pk if instance else None)
                .aggregate(total=Sum("quantity"))["total"] or 0
            )
            allocated = booking_allocated + borrow_allocated
            remaining = max(equipment.quantity - allocated, 0)
            if quantity > remaining:
                raise serializers.ValidationError(
                    {
                        "quantity": (
                            f"Stok {equipment.name} tidak mencukupi pada rentang waktu yang dipilih. "
                            f"Stok total {equipment.quantity}, sudah teralokasi {allocated} unit "
                            f"(sisa {remaining} unit)."
                        )
                    }
                )

        return attrs

    class Meta:
        model = Borrow
        fields = "__all__"
        read_only_fields = [
            "requested_by",
            "code",
            "approved_by",
            "is_approved_by_mentor",
            "mentor_approved_at",
        ]


# endregion Borrow Main Serializers


# region Borrow List Serializers


class BorrowListSerializer(serializers.ModelSerializer):
    requested_by_detail = RecordProfileListSerializer(source="requested_by", read_only=True)
    approved_by_detail = RecordProfileListSerializer(source="approved_by", read_only=True)
    requester_mentor_profile_detail = RecordProfileListSerializer(
        source="requester_mentor_profile",
        read_only=True,
    )
    equipment_detail = RecordEquipmentWithRoomSerializer(source="equipment", read_only=True)

    class Meta:
        model = Borrow
        fields = [
            "id",
            "code",
            "quantity",
            "start_time",
            "end_time",
            "end_time_actual",
            "purpose",
            "note",
            "inspection_note",
            "status",
            "requested_by_detail",
            "approved_by_detail",
            "approved_at",
            "rejected_at",
            "rejection_note",
            "expired_at",
            "borrowed_at",
            "returned_pending_inspection_at",
            "inspected_at",
            "returned_at",
            "overdue_at",
            "lost_damaged_at",
            "requester_mentor",
            "requester_mentor_profile_detail",
            "is_approved_by_mentor",
            "mentor_approved_at",
            "equipment_detail",
            "created_at",
            "updated_at",
        ]


# endregion Borrow List Serializers


# endregion Borrow Serializers


# region Content And Scheduling Serializers


class AnnouncementListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "content",
            "created_by",
            "created_at",
        ]


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_detail = ProfileSerializer(source="created_by", read_only=True)

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "content",
            "created_by",
            "created_by_detail",
            "created_at",
            "updated_at",
        ]


class ScheduleSerializer(serializers.ModelSerializer):
    room_detail = RoomListSerializer(source="room", read_only=True)

    class Meta:
        model = Schedule
        fields = [
            "id",
            "title",
            "class_name",
            "description",
            "start_time",
            "end_time",
            "category",
            "room",
            "room_detail",
            "created_at",
            "updated_at",
        ]


class FAQSerializer(serializers.ModelSerializer):
    image_detail = ImageSerializer(source="image", read_only=True)

    class Meta:
        model = FAQ
        fields = [
            "id",
            "question",
            "answer",
            "image",
            "image_detail",
            "created_at",
            "updated_at",
        ]


class CalendarEventSerializer(serializers.Serializer):
    id = serializers.CharField()
    source = serializers.CharField()
    title = serializers.CharField()
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField(allow_null=True)
    room_id = serializers.UUIDField(allow_null=True, required=False)
    room_name = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        required=False,
    )
    room_number = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        required=False,
    )
    requested_by_name = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        required=False,
    )
    attendee_count = serializers.IntegerField(allow_null=True, required=False)
    purpose = serializers.CharField(allow_blank=True, allow_null=True, required=False)


class ScheduleFeedItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    source = serializers.CharField()
    source_id = serializers.CharField()
    title = serializers.CharField()
    room_name = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        required=False,
    )
    room_number = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        required=False,
    )
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField(allow_null=True)
    category_label = serializers.CharField()
    schedule_item = serializers.DictField(allow_null=True, required=False)


# endregion Content And Scheduling Serializers


# region Sample Testing Serializers


# region Sample Testing Main Serializers


class PengujianSerializer(serializers.ModelSerializer):
    requested_by_detail = ProfileSerializer(source="requested_by", read_only=True)
    approved_by_detail = ProfileSerializer(source="approved_by", read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        if instance is None:
            if attrs.get("status") not in (None, "Pending"):
                raise serializers.ValidationError(
                    {"status": "Status pengujian sampel hanya boleh di-set melalui action endpoint khusus."}
                )
            if attrs.get("approved_by") is not None:
                raise serializers.ValidationError(
                    {"approved_by": "approved_by tidak boleh diisi saat create."}
                )
            return attrs

        if "status" in attrs:
            if not self.context.get("allow_status_transition"):
                raise serializers.ValidationError(
                    {"status": "Gunakan action status pengujian yang spesifik untuk mengubah status."}
                )
            allowed_next_status = self.context.get("allowed_next_status")
            if allowed_next_status and attrs["status"] != allowed_next_status:
                raise serializers.ValidationError(
                    {"status": f"Transisi status hanya boleh menuju {allowed_next_status}."}
                )

        if "approved_by" in attrs:
            raise serializers.ValidationError(
                {"approved_by": "approved_by tidak boleh diubah langsung."}
            )

        if instance.status != "Pending" and not self.context.get("allow_status_transition"):
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Pengujian sampel yang sudah diproses tidak dapat diubah langsung."
                    ]
                }
            )

        return attrs

    class Meta:
        model = Pengujian
        fields = "__all__"
        read_only_fields = ["requested_by", "code", "approved_by"]


# endregion Sample Testing Main Serializers


# region Sample Testing List Serializers


class PengujianListSerializer(serializers.ModelSerializer):
    requested_by_detail = RecordProfileListSerializer(source="requested_by", read_only=True)
    approved_by_detail = RecordProfileListSerializer(source="approved_by", read_only=True)

    class Meta:
        model = Pengujian
        fields = [
            "id",
            "code",
            "name",
            "institution",
            "institution_address",
            "email",
            "phone_number",
            "sample_name",
            "sample_type",
            "sample_brand",
            "sample_packaging",
            "sample_weight",
            "sample_quantity",
            "sample_testing_serving",
            "sample_testing_method",
            "sample_testing_type",
            "status",
            "requested_by_detail",
            "approved_by_detail",
            "approved_at",
            "rejected_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]


# endregion Sample Testing List Serializers


# endregion Sample Testing Serializers




# region Dashboard Overview Serializers


class DashboardOverviewTotalsSerializer(serializers.Serializer):
    total_requests = serializers.IntegerField()
    pending = serializers.IntegerField()
    approved = serializers.IntegerField()
    completed = serializers.IntegerField()
    rejected = serializers.IntegerField()
    expired = serializers.IntegerField()


class DashboardOverviewUpcomingSerializer(serializers.Serializer):
    id = serializers.CharField()
    title = serializers.CharField()
    type = serializers.CharField()
    requester_name = serializers.CharField(allow_blank=True, required=False)
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField(allow_null=True)
    href = serializers.CharField()


class DashboardOverviewActivitySerializer(serializers.Serializer):
    id = serializers.CharField()
    title = serializers.CharField()
    code = serializers.CharField(allow_blank=True)
    type = serializers.CharField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    href = serializers.CharField()


class DashboardOverviewSerializer(serializers.Serializer):
    totals = DashboardOverviewTotalsSerializer()
    upcoming_approved = DashboardOverviewUpcomingSerializer(many=True)
    recent_activities = DashboardOverviewActivitySerializer(many=True)


# endregion Dashboard Overview Serializers


# region Utilities


def _resolve_requester_profile(serializer_instance):
    request = serializer_instance.context.get("request")
    request_user = getattr(request, "user", None)
    request_profile = getattr(request_user, "profile", None)
    if request_profile is not None:
        return request_profile
    instance = getattr(serializer_instance, "instance", None)
    return getattr(instance, "requested_by", None)


def _apply_requester_mentor_rules(serializer_instance, attrs):
    purpose = attrs.get("purpose", getattr(serializer_instance.instance, "purpose", "Other"))
    requester_profile = _resolve_requester_profile(serializer_instance)
    mentor_profile = attrs.get(
        "requester_mentor_profile",
        getattr(serializer_instance.instance, "requester_mentor_profile", None),
    )
    is_internal_requester = (
        requester_profile is not None
        and str(getattr(requester_profile, "role", "") or "").strip().lower() != "guest"
    )

    if purpose != "Skripsi/TA":
        attrs["requester_mentor"] = None
        attrs["requester_mentor_profile"] = None
        attrs["is_approved_by_mentor"] = False
        attrs["mentor_approved_at"] = None
        return attrs

    if not is_internal_requester:
        attrs["requester_mentor"] = None
        attrs["requester_mentor_profile"] = None
        attrs["is_approved_by_mentor"] = False
        attrs["mentor_approved_at"] = None
        return attrs

    if mentor_profile is None:
        raise serializers.ValidationError(
            {"requester_mentor_profile": "Dosen pembimbing wajib dipilih untuk tujuan Skripsi/TA."}
        )

    if (
        str(getattr(mentor_profile, "role", "") or "").strip().lower() != "lecturer"
        or not bool(getattr(mentor_profile, "is_mentor", False))
    ):
        raise serializers.ValidationError(
            {"requester_mentor_profile": "User yang dipilih harus lecturer yang terdaftar sebagai dosen pembimbing."}
        )

    attrs["requester_mentor"] = (
        str(getattr(mentor_profile, "full_name", "") or "").strip()
        or getattr(getattr(mentor_profile, "user", None), "email", None)
        or None
    )
    return attrs


# region Surat Bebas Lab Serializers


class SuratBebasLabBookingHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SuratBebasLabBookingHistory
        fields = ["id", "lab_room_name", "start_date", "end_date"]


class BookingSuggestionSerializer(serializers.ModelSerializer):
    lab_room_name = serializers.CharField(source="room.name", read_only=True)
    start_date = serializers.SerializerMethodField()
    end_date = serializers.SerializerMethodField()

    def get_start_date(self, obj):
        return obj.start_time.date().isoformat() if obj.start_time else None

    def get_end_date(self, obj):
        return obj.end_time.date().isoformat() if obj.end_time else None

    class Meta:
        model = Booking
        fields = ["id", "code", "lab_room_name", "start_date", "end_date", "status"]


class SuratBebasLabDocumentSerializer(serializers.ModelSerializer):
    document_url = serializers.SerializerMethodField()

    def get_document_url(self, obj):
        request = self.context.get("request")
        if obj.document and request:
            return request.build_absolute_uri(obj.document.url)
        return None

    class Meta:
        model = Document
        fields = [
            "id",
            "document_type",
            "original_name",
            "mime_type",
            "size",
            "document_url",
            "created_at",
        ]


class SuratBebasLabSerializer(serializers.ModelSerializer):
    requested_by_detail = ProfileSerializer(source="requested_by", read_only=True)
    reviewed_by_detail = ProfileSerializer(source="reviewed_by", read_only=True)
    documents = SuratBebasLabDocumentSerializer(many=True, read_only=True)
    booking_histories = SuratBebasLabBookingHistorySerializer(many=True, read_only=True)

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        if instance is None:
            if attrs.get("status") not in (None, "Pending"):
                raise serializers.ValidationError(
                    {"status": "Status hanya boleh diubah melalui action approve/reject."}
                )
        elif "status" in attrs and not self.context.get("allow_status_transition"):
            raise serializers.ValidationError(
                {"status": "Gunakan action approve atau reject untuk mengubah status."}
            )
        return attrs

    class Meta:
        model = SuratBebasLab
        fields = "__all__"
        read_only_fields = ["requested_by", "code", "reviewed_by", "reviewed_at"]


class SuratBebasLabListSerializer(serializers.ModelSerializer):
    requested_by_detail = serializers.SerializerMethodField()
    reviewed_by_detail = serializers.SerializerMethodField()
    document_count = serializers.SerializerMethodField()
    documents = SuratBebasLabDocumentSerializer(many=True, read_only=True)
    booking_histories = SuratBebasLabBookingHistorySerializer(many=True, read_only=True)

    def get_requested_by_detail(self, obj):
        p = obj.requested_by
        if not p:
            return None
        return {
            "id": str(p.id),
            "full_name": p.full_name or "",
            "id_number": p.id_number or "",
            "email": p.user.email if p.user else "",
            "department": p.department or "",
            "batch": p.batch or "",
        }

    def get_reviewed_by_detail(self, obj):
        p = obj.reviewed_by
        if not p:
            return None
        return {
            "id": str(p.id),
            "full_name": p.full_name or "",
            "email": p.user.email if p.user else "",
        }

    def get_document_count(self, obj):
        return obj.documents.count()

    class Meta:
        model = SuratBebasLab
        fields = [
            "id",
            "code",
            "status",
            "note",
            "requested_by_detail",
            "reviewed_by_detail",
            "document_count",
            "documents",
            "booking_histories",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]


# endregion Surat Bebas Lab Serializers


# endregion Utilities
