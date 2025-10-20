from django.contrib import admin
from .models import Machine, UserProfile, ActionLog

@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'points')

@admin.register(ActionLog)
class ActionLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'machine', 'action', 'created_at')
    list_filter = ('action', 'created_at')
