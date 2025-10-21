from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('laundry', '0005_machine_started_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='machine',
            name='last_emptied_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]
