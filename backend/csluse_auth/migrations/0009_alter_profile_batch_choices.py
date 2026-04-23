from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("csluse_auth", "0008_alter_profile_department_alter_profile_user_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="batch",
            field=models.CharField(
                blank=True,
                choices=[
                    ("2022", "2022"),
                    ("2023", "2023"),
                    ("2024", "2024"),
                    ("2025", "2025"),
                    ("2026", "2026"),
                    ("2027", "2027"),
                    ("2028", "2028"),
                    ("2029", "2029"),
                    ("2030", "2030"),
                ],
                max_length=4,
                null=True,
            ),
        ),
    ]
