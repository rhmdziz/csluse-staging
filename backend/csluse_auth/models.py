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


class Department(BaseModel):
    name = models.CharField(max_length=466, unique=True)

    class Meta:
        ordering = ("name",)

    def save(self, *args, **kwargs):
        self.name = re.sub(r"\s+", " ", str(self.name or "")).strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


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
    department = models.CharField(max_length=120, blank=True, null=True)
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
