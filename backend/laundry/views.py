from datetime import timedelta
import json
from django.http import JsonResponse, StreamingHttpResponse, HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.db import transaction

from .models import Machine, Cycle


def serialize_machine(machine: Machine) -> dict:
    active = machine.active_cycle
    return {
        "id": machine.id,
        "name": machine.name,
        "is_active": machine.is_active,
        "active_cycle": (
            {
                "id": active.id,
                "started_at": active.started_at.isoformat(),
                "expected_end_at": active.expected_end_at.isoformat() if active.expected_end_at else None,
            }
            if active
            else None
        ),
    }


@require_http_methods(["GET"])
def list_machines(request: HttpRequest):
    machines = Machine.objects.order_by("id").all()
    return JsonResponse([serialize_machine(m) for m in machines], safe=False)


@require_http_methods(["POST"])
@transaction.atomic
def start_cycle(request: HttpRequest, machine_id: int):
    machine = get_object_or_404(Machine, pk=machine_id)
    if machine.active_cycle:
        return JsonResponse({"error": "Machine already running"}, status=400)

    minutes = 45
    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else None
    except Exception:
        payload = None
    if payload and isinstance(payload, dict) and "minutes" in payload:
        try:
            minutes = int(payload["minutes"]) or minutes
        except Exception:
            pass

    expected_end = timezone.now() + timedelta(minutes=minutes)
    cycle = Cycle.objects.create(machine=machine, expected_end_at=expected_end)

    _broadcast_event("cycle_started", {"machine_id": machine.id, "cycle_id": cycle.id})
    return JsonResponse({"ok": True, "cycle_id": cycle.id})


@require_http_methods(["POST"])
@transaction.atomic
def end_cycle(request: HttpRequest, machine_id: int):
    machine = get_object_or_404(Machine, pk=machine_id)
    cycle = machine.active_cycle
    if not cycle:
        return JsonResponse({"error": "No active cycle"}, status=400)
    cycle.ended_at = timezone.now()
    cycle.save(update_fields=["ended_at"])

    _broadcast_event("cycle_finished", {"machine_id": machine.id, "cycle_id": cycle.id})
    return JsonResponse({"ok": True})


# --- Minimal SSE hub (in-memory, dev only) ---
_sse_clients = set()


def _broadcast_event(event: str, data: dict):
    line = f"event: {event}\ndata: {data}\n\n"
    for write in list(_sse_clients):
        try:
            write(line)
        except Exception:
            _sse_clients.discard(write)


@require_http_methods(["GET"])
def sse(request: HttpRequest):
    def event_stream():
        yield "retry: 2000\n\n"

        # Wrap generator to capture write callable
        # We cannot directly push into generator; instead, keep a per-client buffer.
        # For a simple dev hub: we'll poll periodically and flush a heartbeat.
        import queue

        buffer = queue.Queue()

        def write_fn(line: str):
            buffer.put(line)

        _sse_clients.add(write_fn)

        try:
            while True:
                try:
                    item = buffer.get(timeout=15)
                    yield item
                except Exception:
                    # heartbeat to keep connection alive
                    yield "event: ping\ndata: {}\n\n"
        finally:
            _sse_clients.discard(write_fn)

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # for some proxies
    return response
