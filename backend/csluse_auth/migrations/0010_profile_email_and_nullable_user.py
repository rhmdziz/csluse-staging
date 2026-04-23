from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def populate_profile_email(apps, schema_editor):
    Profile = apps.get_model("csluse_auth", "Profile")

    for profile in Profile.objects.select_related("user").all():
        user = getattr(profile, "user", None)
        email = ""
        if user is not None:
            email = str(getattr(user, "email", "") or "").strip().lower()
        if not email:
            email = f"legacy-profile-{profile.pk}@placeholder.local"

        Profile.objects.filter(pk=profile.pk).update(email=email)


class Migration(migrations.Migration):

    dependencies = [
        ("csluse_auth", "0009_alter_profile_batch_choices"),
        ("csluse_auth", "0009_profile_is_mentor"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="user",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="profile",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="profile",
            name="email",
            field=models.EmailField(blank=True, default="", max_length=254),
            preserve_default=False,
        ),
        migrations.RunPython(populate_profile_email, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="profile",
            name="email",
            field=models.EmailField(max_length=254, unique=True),
        ),
    ]
