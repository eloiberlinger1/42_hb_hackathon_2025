from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('laundry', '0002_seed_machines'),
    ]

    operations = [
        migrations.AddField(
            model_name='machine',
            name='status',
            field=models.CharField(default='idle', max_length=16),
        ),
        migrations.AddField(
            model_name='machine',
            name='ends_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
