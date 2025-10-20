from django.db import migrations, models

def set_floors(apps, schema_editor):
    Machine = apps.get_model('laundry', 'Machine')
    machines = list(Machine.objects.order_by('id'))
    for idx, m in enumerate(machines, start=1):
        # 1-2: second floor; 3-4: floor
        m.floor = 'second floor' if idx <= 2 else 'floor'
        m.save(update_fields=['floor'])

class Migration(migrations.Migration):
    dependencies = [
        ('laundry', '0003_machine_status_ends_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='machine',
            name='floor',
            field=models.CharField(default='floor', max_length=32),
        ),
        migrations.RunPython(set_floors, migrations.RunPython.noop),
    ]
