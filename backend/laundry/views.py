from django.db.models import Count, F
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
import json
from datetime import timedelta
from django.utils import timezone
from .models import Machine, UserProfile, ActionLog


def get_or_create_user(name: str) -> UserProfile:
    user, _ = UserProfile.objects.get_or_create(name=name)
    return user


def ensure_machine(machine_id: int) -> Machine:
    return Machine.objects.get(pk=machine_id)


@csrf_exempt
def start_machine(request: HttpRequest):
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8'))
        machine_id = int(payload['machine_id'])
        cycle_minutes = int(payload.get('cycle_minutes', 45))
        user_name = str(payload['user_name']).strip()
    except Exception:
        return JsonResponse({'error': 'invalid payload'}, status=400)

    if not user_name:
        return JsonResponse({'error': 'user_name required'}, status=400)

    try:
        machine = ensure_machine(machine_id)
    except Machine.DoesNotExist:
        return JsonResponse({'error': 'machine not found'}, status=404)

    user = get_or_create_user(user_name)
    ActionLog.objects.create(user=user, machine=machine, action='start')
    # +1 point for starting a machine
    UserProfile.objects.filter(pk=user.pk).update(points=F('points') + 1)

    # Update machine state
    machine.status = 'running'
    machine.ends_at = timezone.now() + timedelta(minutes=cycle_minutes)
    machine.save(update_fields=['status', 'ends_at'])

    return JsonResponse({'ok': True})


@csrf_exempt
def empty_machine(request: HttpRequest):
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8'))
        machine_id = int(payload['machine_id'])
        user_name = str(payload['user_name']).strip()
    except Exception:
        return JsonResponse({'error': 'invalid payload'}, status=400)

    if not user_name:
        return JsonResponse({'error': 'user_name required'}, status=400)

    try:
        machine = ensure_machine(machine_id)
    except Machine.DoesNotExist:
        return JsonResponse({'error': 'machine not found'}, status=404)

    user = get_or_create_user(user_name)
    ActionLog.objects.create(user=user, machine=machine, action='empty')
    # +5 points for emptying a machine
    UserProfile.objects.filter(pk=user.pk).update(points=F('points') + 5)

    # Reset machine state
    machine.status = 'idle'
    machine.ends_at = None
    machine.save(update_fields=['status', 'ends_at'])

    return JsonResponse({'ok': True})


def leaderboard(request: HttpRequest):
    users = (
        UserProfile.objects.all()
        .annotate(starts=Count('actionlog', filter=F('actionlog__action') == 'start'))
        .order_by('-points', '-starts', 'name')
    )
    data = [
        {
            'user': u.name,
            'starts': int(u.starts or 0),
            'points': int(u.points),
        }
        for u in users
    ]
    return JsonResponse({'leaderboard': data})


def state(request: HttpRequest):
    machines = Machine.objects.order_by('id').values('id', 'name', 'status', 'ends_at')
    out = []
    now = timezone.now()
    for m in machines:
        remaining_minutes = None
        if m['status'] == 'running' and m['ends_at']:
            delta = m['ends_at'] - now
            remaining_minutes = max(0, int((delta.total_seconds() + 59) // 60))
            if delta.total_seconds() <= 0:
                m['status'] = 'finished'
                remaining_minutes = 0
        out.append({
            'id': str(m['id']),
            'name': m['name'],
            'status': m['status'],
            'remaining_minutes': remaining_minutes,
        })
    return JsonResponse({'machines': out})
