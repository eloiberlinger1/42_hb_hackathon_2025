from django.contrib import admin
from .models import Machine, Cycle


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_active", "created_at")
    search_fields = ("name",)


@admin.register(Cycle)
class CycleAdmin(admin.ModelAdmin):
    list_display = ("id", "machine", "started_at", "expected_end_at", "ended_at")
    list_filter = ("machine", "ended_at")
