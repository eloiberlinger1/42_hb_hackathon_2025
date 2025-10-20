from django.db import migrations


def seed_machines(apps, schema_editor):
    Machine = apps.get_model("laundry", "Machine")
    names = ["Machine 1", "Machine 2", "Machine 3", "Machine 4"]
    for name in names:
        Machine.objects.get_or_create(name=name)


def unseed_machines(apps, schema_editor):
    Machine = apps.get_model("laundry", "Machine")
    Machine.objects.filter(name__in=["Machine 1", "Machine 2", "Machine 3", "Machine 4"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("laundry", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_machines, reverse_code=unseed_machines),
    ]


