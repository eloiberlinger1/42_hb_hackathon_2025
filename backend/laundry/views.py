from django.db.models import Count, F
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
import json
from datetime import timedelta
from django.utils import timezone
from .models import Machine, UserProfile, ActionLog
# views.py
import requests
from django.conf import settings
from django.shortcuts import redirect
from django.http import JsonResponse

def forty_two_callback(request):
    code = request.GET.get("code")
    if not code:
        return JsonResponse({"error": "No code provided"}, status=400)

    # Exchange code for token
    token_res = requests.post(
        "https://api.intra.42.fr/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": settings.FORTYTWO_CLIENT_ID,
            "client_secret": settings.FORTYTWO_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.FORTYTWO_REDIRECT_URI,
        },
    )
    token_data = token_res.json()

    # Use access token to get user info
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    user_res = requests.get("https://api.intra.42.fr/v2/me", headers=headers)
    user_data = user_res.json()

    # Example: create or get user in your DB
    # user = User.objects.get_or_create(email=user_data["email"], ...)
    # login(request, user)

    return JsonResponse(user_data)


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
    UserProfile.objects.filter(pk=user.pk).update(points=F('points') + 1)

    machine.status = 'running'
    machine.ends_at = timezone.now() + timedelta(minutes=cycle_minutes)
    machine.started_by = user
    machine.save(update_fields=['status', 'ends_at', 'started_by'])

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
    UserProfile.objects.filter(pk=user.pk).update(points=F('points') + 5)

    machine.status = 'idle'
    machine.ends_at = None
    machine.started_by = None
    machine.save(update_fields=['status', 'ends_at', 'started_by'])

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
    machines = Machine.objects.order_by('id').values('id', 'name', 'status', 'ends_at', 'floor', 'started_by__name')
    out = []
    now = timezone.now()
    for m in machines:
        remaining_minutes = None
        status = m['status']
        if status == 'running' and m['ends_at']:
            delta = m['ends_at'] - now
            remaining_minutes = max(0, int((delta.total_seconds() + 59) // 60))
            if delta.total_seconds() <= 0:
                status = 'finished'
                remaining_minutes = 0
        out.append({
            'id': str(m['id']),
            'name': m['name'],
            'status': status,
            'remaining_minutes': remaining_minutes,
            'floor': m['floor'],
            'started_by': m['started_by__name'],
        })
    return JsonResponse({'machines': out})
