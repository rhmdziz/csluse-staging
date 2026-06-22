from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("csluse_auth", "0012_department_and_profile_department_seed"),
    ]

    operations = [
        migrations.AlterField(
            model_name="department",
            name="name",
            field=models.CharField(max_length=400, unique=True),
        ),
    ]
