import re
import uuid

from django.contrib.auth import get_user_model
from django.db import models


# region Base Models


class BaseModel(models.Model):
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# endregion Base Models


# region Profile Models


class Profile(BaseModel):
    USER_TYPE_CHOICES = [
        ("Internal", "Internal"),
        ("External", "External"),
    ]
    ROLE_CHOICES = [
        ("Student", "Student"),
        ("Lecturer", "Lecturer"),
        ("Admin", "Admin"),
        ("Staff", "Staff"),
        ("Guest", "Guest"),
    ]
    DEPARTMENT_CHOICE = [
        ("Accounting", "Accounting"),
        ("Business", "Business"),
        ("Event", "Event"),
        ("Finance & Banking", "Finance & Banking"),
        ("Branding", "Branding"),
        ("Renewable Energy Engineering", "Renewable Energy Engineering"),
        ("Energy Business and Technology", "Energy Business and Technology"),
        ("Digital Business Technology", "Digital Business Technology"),
        ("Food Business Technology", "Food Business Technology"),
        ("Business Mathematics", "Business Mathematics"),
        ("Computer Systems Engineering", "Computer Systems Engineering"),
        ("Business Economics", "Business Economics"),
        ("Hospitality Business", "Hospitality Business"),
        ("International Business Law", "International Business Law"),
        ("Product Design Innovation", "Product Design Innovation"),
        ("Artificial Inteligence and Robotic", "Artificial Inteligence and Robotic"),
        ("Hukum Bisnis Internasional", "Hukum Bisnis Internasional"),
        ("S2 Manajemen Pemasaran dan Keuangan", "S2 Manajemen Pemasaran dan Keuangan"),
        ("S2 Bisnis Analitik Terapan", "S2 Bisnis Analitik Terapan"),
        ("S2 Inovasi Bisnis Baru", "S2 Inovasi Bisnis Baru"),
        ("S2 Manajemen Bisnis", "S2 Manajemen Bisnis"),
        ("S2 Manajemen Stratejik", "S2 Manajemen Stratejik"),
        ("S3 Manajemen dan Kewirausahaan", "S3 Manajemen dan Kewirausahaan"),
        ("Lainnya", "Lainnya"),
    ]
    user = models.OneToOneField(
        get_user_model(),
        on_delete=models.SET_NULL,
        related_name="profile",
        blank=True,
        null=True,
    )
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    initials = models.CharField(max_length=3, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, blank=True, null=True)
    is_mentor = models.BooleanField(default=False)
    department = models.CharField(max_length=40, choices=DEPARTMENT_CHOICE, blank=True, null=True)
    id_number = models.CharField(max_length=40, blank=True, null=True)
    batch = models.CharField(max_length=4, blank=True, null=True)
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default="External")
    institution = models.CharField(max_length=255, blank=True, null=True)

    @staticmethod
    def normalize_initials(value, full_name="", email=""):
        normalized = re.sub(r"[^A-Za-z0-9]+", "", str(value or "")).upper()[:3]
        if normalized:
            return normalized

        source = str(full_name or "").strip()
        if source:
            words = [re.sub(r"[^A-Za-z0-9]+", "", word) for word in source.split()]
            words = [word for word in words if word]
            candidate = "".join(word[0] for word in words[:3]).upper()
            if len(candidate) < 3:
                candidate += "".join(words).upper()
            candidate = re.sub(r"[^A-Z0-9]+", "", candidate)[:3]
            if candidate:
                return candidate

        local_part = str(email or "").split("@")[0]
        fallback = re.sub(r"[^A-Za-z0-9]+", "", local_part).upper()[:3]
        return fallback or "USR"

    def save(self, *args, **kwargs):
        self.email = str(self.email or getattr(self.user, "email", "") or "").strip().lower()
        self.initials = self.normalize_initials(
            self.initials,
            full_name=self.full_name,
            email=self.email,
        )

        if self.role != "Guest":
            self.institution = None
        elif self.institution == "":
            self.institution = None

        if self.role != "Lecturer":
            self.is_mentor = False

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.email} - {self.full_name} - {self.role}"


# endregion Profile Models
