from django.db import models
from django.utils import timezone


class Machine(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name

    @property
    def active_cycle(self):
        return self.cycles.filter(ended_at__isnull=True).order_by("-started_at").first()


class Cycle(models.Model):
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE, related_name="cycles")
    started_at = models.DateTimeField(default=timezone.now)
    expected_end_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["machine", "ended_at"]),
        ]

    def __str__(self) -> str:
        status = "running" if self.ended_at is None else "finished"
        return f"{self.machine.name} cycle {status} @ {self.started_at.isoformat()}"
