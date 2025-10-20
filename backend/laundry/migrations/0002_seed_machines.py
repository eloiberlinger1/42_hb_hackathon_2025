from django.db import migrations

def seed_machines(apps, schema_editor):
    Machine = apps.get_model('laundry', 'Machine')
    for i in range(1, 5):
        Machine.objects.get_or_create(name=f'Dishwasher {i}')

def unseed_machines(apps, schema_editor):
    Machine = apps.get_model('laundry', 'Machine')
    Machine.objects.filter(name__startswith='Dishwasher ').delete()

class Migration(migrations.Migration):
    dependencies = [
        ('laundry', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_machines, unseed_machines),
    ]
