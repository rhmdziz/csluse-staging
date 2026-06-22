import uuid

from django.db import migrations, models


DEFAULT_DEPARTMENT_NAMES = [
    "Accounting",
    "Business",
    "Event",
    "Finance & Banking",
    "Branding",
    "Energy Business and Technology",
    "Digital Business Technology",
    "Food Business Technology",
    "Business Mathematics",
    "Business Economics",
    "Hospitality Business",
    "International Business Law",
    "Product Design Innovation",
    "Artificial Inteligence and Robotic",
    "International Marketing",
    "Financial Technology",
    "S2 Manajemen Pemasaran dan Keuangan",
    "S2 Bisnis Analitik Terapan",
    "S2 Inovasi Bisnis Baru",
    "S2 Manajemen Bisnis",
    "S2 Manajemen Stratejik",
    "S3 Manajemen dan Kewirausahaan",
    "Lainnya",
]


def seed_departments_and_normalize_profiles(apps, schema_editor):
    Department = apps.get_model("csluse_auth", "Department")
    Profile = apps.get_model("csluse_auth", "Profile")

    existing_names = set()
    for name in DEFAULT_DEPARTMENT_NAMES:
        normalized = " ".join(str(name or "").split()).strip()
        if not normalized or normalized.lower() in existing_names:
            continue
        Department.objects.get_or_create(name=normalized)
        existing_names.add(normalized.lower())

    for profile in Profile.objects.exclude(department__isnull=True).exclude(department=""):
        normalized = " ".join(str(profile.department or "").split()).strip()
        if not normalized:
            if profile.department:
                profile.department = None
                profile.save(update_fields=["department"])
            continue

        department, _ = Department.objects.get_or_create(name=normalized)
        if profile.department != department.name:
            profile.department = department.name
            profile.save(update_fields=["department"])


class Migration(migrations.Migration):

    dependencies = [
        ("csluse_auth", "0011_alter_profile_batch"),
    ]

    operations = [
        migrations.CreateModel(
            name="Department",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120, unique=True)),
            ],
            options={
                "ordering": ("name",),
            },
        ),
        migrations.AlterField(
            model_name="profile",
            name="department",
            field=models.CharField(blank=True, max_length=120, null=True),
        ),
        migrations.RunPython(seed_departments_and_normalize_profiles, migrations.RunPython.noop),
    ]
