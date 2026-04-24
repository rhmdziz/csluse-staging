from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("csluse", "0049_booking_requester_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="room_name",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
