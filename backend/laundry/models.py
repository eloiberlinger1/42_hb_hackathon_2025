from django.db import models
from django.utils import timezone

class UserProfile(models.Model):
    name = models.CharField(max_length=100, unique=True)
    points = models.IntegerField(default=0)

    def __str__(self) -> str:  # pragma: no cover
        return self.name

class Machine(models.Model):
    name = models.CharField(max_length=100)
    status = models.CharField(max_length=16, default='idle')  # idle|running|finished
    ends_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:  # pragma: no cover
        return self.name

class ActionLog(models.Model):
    ACTION_CHOICES = (
        ('start', 'Start'),
        ('empty', 'Empty'),
    )
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE)
    action = models.CharField(max_length=16, choices=ACTION_CHOICES)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [
            models.Index(fields=['action']),
            models.Index(fields=['created_at']),
        ]
