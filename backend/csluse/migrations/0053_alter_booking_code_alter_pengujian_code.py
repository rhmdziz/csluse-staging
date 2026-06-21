from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("csluse", "0052_notification_target_path"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pengujian",
            name="code",
            field=models.CharField(editable=False, max_length=13, null=True, unique=True),
        ),
    ]
