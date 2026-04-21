from django.db import migrations, models


def migrate_waiting_payment_to_diproses(apps, schema_editor):
    Pengujian = apps.get_model("csluse", "Pengujian")
    Pengujian.objects.filter(status="Menunggu Pembayaran").update(status="Diproses")


class Migration(migrations.Migration):

    dependencies = [
        ("csluse", "0042_suratbebaslab_and_more"),
    ]

    operations = [
        migrations.RunPython(
            migrate_waiting_payment_to_diproses,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="pengujian",
            name="status",
            field=models.CharField(
                choices=[
                    ("Pending", "Pending"),
                    ("Approved", "Approved"),
                    ("Canceled", "Canceled"),
                    ("Diproses", "Diproses"),
                    ("Rejected", "Rejected"),
                    ("Completed", "Completed"),
                ],
                default="Pending",
                max_length=20,
            ),
        ),
    ]
