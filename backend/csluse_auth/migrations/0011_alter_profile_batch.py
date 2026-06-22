from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("csluse_auth", "0010_profile_email_and_nullable_user"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="batch",
            field=models.CharField(blank=True, max_length=4, null=True),
        ),
    ]
