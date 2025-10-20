from django.db.models import Count, F
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
import json
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

    return JsonResponse({'ok': True})


def leaderboard(request: HttpRequest):
    # Combine points and number of starts for display
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
