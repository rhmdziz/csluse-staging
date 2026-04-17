from django.db import migrations, models


def reset_is_useable_to_false(apps, schema_editor):
    Equipment = apps.get_model('csluse', 'Equipment')
    Equipment.objects.all().update(is_useable=False)


class Migration(migrations.Migration):

    dependencies = [
        ('csluse', '0037_equipment_is_useable'),
    ]

    operations = [
        migrations.RunPython(reset_is_useable_to_false, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='equipment',
            name='is_useable',
            field=models.BooleanField(default=False),
        ),
    ]
