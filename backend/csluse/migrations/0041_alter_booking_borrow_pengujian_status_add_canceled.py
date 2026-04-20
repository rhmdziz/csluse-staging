from django.db import migrations, models


def migrate_cancelled_to_canceled(apps, schema_editor):
    booking_model = apps.get_model("csluse", "Booking")
    borrow_model = apps.get_model("csluse", "Borrow")
    pengujian_model = apps.get_model("csluse", "Pengujian")

    booking_model.objects.filter(status="Cancelled").update(status="Canceled")
    borrow_model.objects.filter(status="Cancelled").update(status="Canceled")
    pengujian_model.objects.filter(status="Cancelled").update(status="Canceled")


class Migration(migrations.Migration):

    dependencies = [
        ("csluse", "0040_alter_document_document_type_add_receipt"),
    ]

    operations = [
        migrations.RunPython(
            migrate_cancelled_to_canceled,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="booking",
            name="status",
            field=models.CharField(
                choices=[
                    ("Pending", "Pending"),
                    ("Approved", "Approved"),
                    ("Canceled", "Canceled"),
                    ("Rejected", "Rejected"),
                    ("Expired", "Expired"),
                    ("Completed", "Completed"),
                ],
                default="Pending",
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="borrow",
            name="status",
            field=models.CharField(
                choices=[
                    ("Pending", "Pending"),
                    ("Approved", "Approved"),
                    ("Canceled", "Canceled"),
                    ("Rejected", "Rejected"),
                    ("Expired", "Expired"),
                    ("Borrowed", "Borrowed"),
                    ("Returned Pending Inspection", "Returned Pending Inspection"),
                    ("Returned", "Returned"),
                    ("Overdue", "Overdue"),
                    ("Lost/Damaged", "Lost/Damaged"),
                ],
                default="Pending",
                max_length=32,
            ),
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
                    ("Menunggu Pembayaran", "Menunggu Pembayaran"),
                    ("Rejected", "Rejected"),
                    ("Completed", "Completed"),
                ],
                default="Pending",
                max_length=20,
            ),
        ),
    ]
