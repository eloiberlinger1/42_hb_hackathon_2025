from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone

class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('points', models.IntegerField(default=0)),
            ],
        ),
        migrations.CreateModel(
            name='Machine',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
            ],
        ),
        migrations.CreateModel(
            name='ActionLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('start', 'Start'), ('empty', 'Empty')], max_length=16)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('machine', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='laundry.machine')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='laundry.userprofile')),
            ],
        ),
        migrations.AddIndex(
            model_name='actionlog',
            index=models.Index(fields=['action'], name='laundry_act_action_2e584b_idx'),
        ),
        migrations.AddIndex(
            model_name='actionlog',
            index=models.Index(fields=['created_at'], name='laundry_act_created_29d707_idx'),
        ),
    ]
