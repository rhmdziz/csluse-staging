import uuid

from django.db import models, transaction
from django.utils import timezone

from csluse_auth.models import Profile


PURPOSE_CHOICES = [
    ("Skripsi/TA", "Skripsi/TA"),
    ("Praktikum", "Praktikum"),
    ("Penelitian", "Penelitian"),
    ("Workshop", "Workshop"),
]


# region Base Models


class BaseModel(models.Model):
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# endregion Base Models


# region Inventory Models


class Image(BaseModel):
    image = models.ImageField(upload_to="images/")
    name = models.CharField(max_length=255, blank=True)
    url = models.URLField(blank=True)
    created_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="images_created_by",
    )

    def __str__(self):
        creator_email = self.created_by.user.email if self.created_by else "unknown"
        return f"{self.name or self.image.name} - {creator_email}"


class Room(BaseModel):
    name = models.CharField(max_length=255)
    capacity = models.PositiveIntegerField()
    description = models.CharField(max_length=2000, blank=True, null=True)
    number = models.CharField(max_length=25)
    floor = models.CharField(max_length=25)
    pics = models.ManyToManyField(
        Profile,
        blank=True,
        related_name="rooms_as_pic",
    )
    def __str__(self):
        return f"{self.name} - {self.number} - Floor {self.floor}"


class Equipment(BaseModel):
    STATUS_CHOICES = [
        ("Available", "Available"),
        ("Under Maintenance", "Under Maintenance"),
        ("Broken", "Broken"),
        ("In Storage", "In Storage"),
    ]
    CATEGORY_CHOICES = [
        ("Electricity", "Electricity"),
        ("Electronics", "Electronics"),
        ("Computer", "Computer"),
        ("Large Equipment", "Large Equipment"),
        ("Furniture", "Furniture"),
        ("Glassware", "Glassware"),
        ("Chemicals", "Chemicals"),
        ("Tools", "Tools"),
        ("Safety Equipment", "Safety Equipment"),
        ("Other", "Other"),
    ]

    name = models.CharField(max_length=255)
    description = models.CharField(max_length=2000, blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Available")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="Other")
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="equipments",
    )
    is_moveable = models.BooleanField(default=True)
    is_shareable = models.BooleanField(default=False)
    is_borrowable = models.BooleanField(default=False)

    def __str__(self):
        room_name = self.room.name if self.room else "Tanpa Ruangan"
        return f"{self.name} - {room_name} - Qty: {self.quantity}"

class Material(BaseModel):
    STATUS_CHOICES = [
        ("Available", "Available"),
        ("In Storage", "In Storage"),
        ("Consumed", "Consumed"),
        ("Expired", "Expired"),
    ]
    CATEGORY_CHOICES = [
        ("Chemicals", "Chemicals"),
        ("Biological Materials", "Biological Materials"),
        ("Consumables", "Consumables"),
        ("Other", "Other"),
    ]
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=2000, blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    unit = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Available")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="Other")
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="materials",
    )

    def __str__(self):
        room_name = self.room.name if self.room else "Tanpa Ruangan"
        return f"{self.name} - {room_name} - Qty: {self.quantity} {self.unit or ''}"

class Software(BaseModel):
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=2000, blank=True, null=True)
    version = models.CharField(max_length=255, blank=True, null=True)
    license_info = models.CharField(max_length=255, blank=True, null=True)
    license_expiration = models.DateField(blank=True, null=True)
    equipment = models.ForeignKey(
        Equipment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="softwares",
    )

    def __str__(self):
        equipment_name = self.equipment.name if self.equipment else "Tanpa Peralatan"
        return f"{self.name} - {self.version} - {equipment_name}"


# endregion Inventory Models


# region Booking Models


class Booking(BaseModel):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Canceled", "Canceled"),
        ("Rejected", "Rejected"),
        ("Expired", "Expired"),
        ("Completed", "Completed"),
    ]

    code = models.CharField(max_length=12, unique=True, editable=False, null=True)
    requested_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bookings",
    )
    requester_phone = models.CharField(max_length=20, blank=True, null=True)
    requester_mentor = models.CharField(max_length=255, blank=True, null=True)
    requester_mentor_profile = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_bookings_as_mentor",
    )
    is_approved_by_mentor = models.BooleanField(default=False)
    mentor_approved_at = models.DateTimeField(blank=True, null=True)

    # if role == guest, then fill in institution and institution_address
    institution = models.CharField(max_length=255, blank=True, null=True)
    institution_address = models.CharField(max_length=555, blank=True, null=True)

    # if purpose == workshop, then fill in workshop_title and workshop_organizer
    workshop_title = models.CharField(max_length=255, blank=True, null=True)
    workshop_pic = models.CharField(max_length=255, blank=True, null=True)
    workshop_institution = models.CharField(max_length=255, blank=True, null=True)

    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bookings",
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    attendee_count = models.PositiveIntegerField(default=1)
    attendee_names = models.CharField(max_length=2000, blank=True, null=True)
    purpose = models.CharField(
        max_length=20,
        choices=PURPOSE_CHOICES,
        default="Other",
    )
    note = models.CharField(max_length=2000, blank=True, null=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="Pending")
    approved_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_bookings",
    )
    approved_at = models.DateTimeField(blank=True, null=True)
    rejected_at = models.DateTimeField(blank=True, null=True)
    rejection_note = models.CharField(max_length=2000, blank=True, null=True)
    expired_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.code:
            now = timezone.localtime(timezone.now())
            yymm = now.strftime("%y%m")
            with transaction.atomic():
                self.code = _next_code(Booking, "PL", yymm)
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.requested_by.user.email} - {self.room.name} - {self.status}"


class BookingEquipmentItem(BaseModel):
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name="equipment_items",
    )
    equipment = models.ForeignKey(
        Equipment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="booking_items",
    )
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.booking.code} - {self.equipment.name} x {self.quantity}"


# endregion Booking Models




# region Borrow Models


class Borrow(BaseModel):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Canceled", "Canceled"),
        ("Rejected", "Rejected"),
        ("Expired", "Expired"),
        ("Borrowed", "Borrowed"),
        ("Returned Pending Inspection", "Returned Pending Inspection"),
        ("Returned", "Returned"),
        ("Overdue", "Overdue"),
        ("Lost/Damaged", "Lost/Damaged"),
    ]

    code = models.CharField(max_length=12, unique=True, editable=False, null=True)
    requested_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="borrows",
    )
    requester_phone = models.CharField(max_length=20, blank=True, null=True)
    requester_mentor = models.CharField(max_length=255, blank=True, null=True)
    requester_mentor_profile = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_borrows_as_mentor",
    )
    is_approved_by_mentor = models.BooleanField(default=False)
    mentor_approved_at = models.DateTimeField(blank=True, null=True)

    # if role == guest, then fill in institution and institution_address
    institution = models.CharField(max_length=255, blank=True, null=True)
    institution_address = models.CharField(max_length=555, blank=True, null=True)

    equipment = models.ForeignKey(
        Equipment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="borrows",
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(blank=True, null=True)
    end_time_actual = models.DateTimeField(blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default="Other")
    note = models.CharField(max_length=2000, blank=True, null=True)
    inspection_note = models.CharField(max_length=2000, blank=True, null=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="Pending")
    approved_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_borrows",
    )
    approved_at = models.DateTimeField(blank=True, null=True)
    rejected_at = models.DateTimeField(blank=True, null=True)
    rejection_note = models.CharField(max_length=2000, blank=True, null=True)
    expired_at = models.DateTimeField(blank=True, null=True)
    borrowed_at = models.DateTimeField(blank=True, null=True)
    returned_pending_inspection_at = models.DateTimeField(blank=True, null=True)
    inspected_at = models.DateTimeField(blank=True, null=True)
    returned_at = models.DateTimeField(blank=True, null=True)
    overdue_at = models.DateTimeField(blank=True, null=True)
    lost_damaged_at = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.code:
            now = timezone.localtime(timezone.now())
            yymm = now.strftime("%y%m")
            with transaction.atomic():
                self.code = _next_code(Borrow, "PJ", yymm)
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.equipment.name} - {self.requested_by.user.email} - {self.status}"


# endregion Borrow Models


# region Sample Testing Models


class Pengujian(BaseModel):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Canceled", "Canceled"),
        ("Diproses", "Diproses"),
        ("Rejected", "Rejected"),
        ("Completed", "Completed"),
    ]

    name = models.CharField(max_length=255)
    institution = models.CharField(max_length=255, blank=True, null=True)
    institution_address = models.CharField(max_length=555, blank=True, null=True)
    email = models.EmailField()
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    sample_name = models.CharField(max_length=255, blank=True, null=True)
    sample_type = models.CharField(max_length=255)
    sample_brand = models.CharField(max_length=255, blank=True, null=True)
    sample_packaging = models.CharField(max_length=255, blank=True, null=True)
    sample_weight = models.CharField(max_length=255, blank=True, null=True)
    sample_quantity = models.CharField(max_length=255, blank=True, null=True)
    sample_testing_serving = models.CharField(max_length=255, blank=True, null=True)
    sample_testing_method = models.CharField(max_length=255, blank=True, null=True)
    sample_testing_type = models.CharField(max_length=255, blank=True, null=True)
    requested_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pengujians",
    )
    approved_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_pengujians",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    code = models.CharField(max_length=12, unique=True, editable=False, null=True)
    approved_at = models.DateTimeField(blank=True, null=True)
    rejected_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.code:
            now = timezone.localtime(timezone.now())
            yymm = now.strftime("%y%m")
            with transaction.atomic():
                self.code = _next_code(Pengujian, "PS", yymm)
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} - {self.email}"


class SuratBebasLab(BaseModel):
    STATUS_CHOICES = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Rejected", "Rejected"),
    ]

    code = models.CharField(max_length=12, unique=True, editable=False, null=True)
    requested_by = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="surat_bebas_lab_requests",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    note = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="surat_bebas_lab_reviews",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.code:
            now = timezone.localtime(timezone.now())
            yymm = now.strftime("%y%m")
            with transaction.atomic():
                self.code = _next_code(SuratBebasLab, "BL", yymm)
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} - {self.requested_by}"


class SuratBebasLabBookingHistory(BaseModel):
    surat_bebas_lab = models.ForeignKey(
        SuratBebasLab,
        on_delete=models.CASCADE,
        related_name="booking_histories",
    )
    lab_room_name = models.CharField(max_length=255)
    start_date = models.DateField()
    end_date = models.DateField()

    def __str__(self):
        return f"{self.surat_bebas_lab.code} - {self.lab_room_name} ({self.start_date})"


class Document(BaseModel):
    DOCUMENT_TYPE_CHOICES = [
        ("testing_agreement", "Surat perjanjian pengujian"),
        ("signed_testing_agreement", "Surat perjanjian pengujian yang sudah ditandatangani"),
        ("invoice", "Invoice"),
        ("payment_proof", "Bukti bayar"),
        ("receipt", "Kuitansi"),
        ("test_result_letter", "Surat hasil uji"),
        ("form_alat_kecil", "F-027A Peminjaman dan Pengembalian Alat Kecil"),
        ("form_alat_besar", "F-027B Pemakaian Alat Besar"),
        ("form_permintaan_bahan", "F-028 Permintaan Bahan"),
    ]

    pengujian = models.ForeignKey(
        Pengujian,
        on_delete=models.CASCADE,
        related_name="documents",
        null=True,
        blank=True,
    )
    surat_bebas_lab = models.ForeignKey(
        SuratBebasLab,
        on_delete=models.CASCADE,
        related_name="documents",
        null=True,
        blank=True,
    )
    document = models.FileField(upload_to="documents/")
    document_type = models.CharField(max_length=64, choices=DOCUMENT_TYPE_CHOICES)
    original_name = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=255, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["pengujian", "document_type"],
                condition=models.Q(pengujian__isnull=False),
                name="unique_pengujian_document_type",
            ),
            models.UniqueConstraint(
                fields=["surat_bebas_lab", "document_type"],
                condition=models.Q(surat_bebas_lab__isnull=False),
                name="unique_surat_bebas_lab_document_type",
            ),
        ]

    def __str__(self):
        parent = self.pengujian or self.surat_bebas_lab
        code = getattr(parent, "code", str(self.id))
        return f"{code} - {self.document_type}"


# endregion Sample Testing Models


# region Notification Models


class Notification(BaseModel):
    CATEGORY_CHOICES = [
        ("Approved", "Approved"),
        ("Rejected", "Rejected"),
        ("Reminder", "Reminder"),
        ("General", "General"),
    ]

    recipient = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=255, choices=CATEGORY_CHOICES, default="General")
    message = models.CharField(max_length=2000)

    def __str__(self):
        return f"Notification for {self.recipient.user.email} - {self.title}"


# endregion Notification Models


# region Content And Scheduling Models


class Announcement(BaseModel):
    title = models.CharField(max_length=255)
    content = models.CharField(max_length=10000)
    created_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="announcements_created_by",
    )

    def __str__(self):
        creator_email = self.created_by.user.email if self.created_by else "unknown"
        return f"{self.title} - {creator_email}"


class Schedule(BaseModel):
    CATEGORY_CHOICES = [
        ("Practicum", "Praktikum"),
    ]

    title = models.CharField(max_length=255)
    class_name = models.CharField(max_length=255, blank=True, null=True)
    description = models.CharField(max_length=2000, blank=True, null=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default="Practicum",
    )
    room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedules",
    )
    created_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="schedules_created_by",
    )

    class Meta:
        ordering = ["start_time", "title"]

    def __str__(self):
        return self.title


class FAQ(BaseModel):
    question = models.CharField(max_length=500)
    answer = models.CharField(max_length=5000)
    image = models.ForeignKey(
        "Image",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="faqs",
    )
    created_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="faqs_created_by",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.question


# endregion Content And Scheduling Models


# region Utilities


def _next_code(model_cls, prefix, yymm):
    base = f"{prefix}{yymm}"
    last = (
        model_cls.objects.select_for_update()
        .filter(code__startswith=base)
        .order_by("-code")
        .first()
    )
    if last and last.code:
        try:
            suffix = last.code[len(base):].lstrip("-")
            last_seq = int(suffix)
        except ValueError:
            last_seq = 0
    else:
        last_seq = 0
    return f"{base}{last_seq + 1:03d}"


# endregion Utilities
