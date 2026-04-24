from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("csluse", "0048_remove_suratbebaslabbookinghistory_timestamps"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="requester_name",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
