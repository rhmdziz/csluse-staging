from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("csluse", "0047_remove_bookingequipmentitem_timestamps"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="suratbebaslabbookinghistory",
            name="created_at",
        ),
        migrations.RemoveField(
            model_name="suratbebaslabbookinghistory",
            name="updated_at",
        ),
    ]
