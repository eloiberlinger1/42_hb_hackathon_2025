from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ('laundry', '0004_machine_floor'),
    ]

    operations = [
        migrations.AddField(
            model_name='machine',
            name='started_by',
            field=models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL, to='laundry.userprofile'),
        ),
    ]
