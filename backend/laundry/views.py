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


def forty_two_login(request: HttpRequest):
    client_id = settings.FORTYTWO_CLIENT_ID
    redirect_uri = settings.FORTYTWO_REDIRECT_URI
    auth_url = (
        "https://api.intra.42.fr/oauth/authorize"
        f"?client_id={client_id}&redirect_uri={requests.utils.quote(redirect_uri, safe='')}"
        "&response_type=code"
    )
    return redirect(auth_url)


def forty_two_callback(request: HttpRequest):
    code = request.GET.get("code")
    if not code:
        return JsonResponse({"error": "No code provided"}, status=400)

    token_res = requests.post(
        "https://api.intra.42.fr/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": settings.FORTYTWO_CLIENT_ID,
            "client_secret": settings.FORTYTWO_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.FORTYTWO_REDIRECT_URI,
        },
        timeout=10,
    )
    token_res.raise_for_status()
    token_data = token_res.json()

    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    user_res = requests.get("https://api.intra.42.fr/v2/me", headers=headers, timeout=10)
    user_res.raise_for_status()
    user_data = user_res.json()

    username = user_data.get("login") or user_data.get("usual_full_name") or user_data.get("email")
    if not username:
        return JsonResponse({"error": "Unable to determine username"}, status=400)
    request.session["user_name"] = username
    request.session["auth_provider"] = "42"
    request.session.save()

    UserProfile.objects.get_or_create(name=username)

    return redirect("/")


def me(request: HttpRequest):
    username = request.session.get("user_name")
    if not username:
        return JsonResponse({"authenticated": False}, status=200)
    return JsonResponse({"authenticated": True, "user": {"name": username}})


def logout_view(request: HttpRequest):
    request.session.flush()
    return JsonResponse({"ok": True})


def _require_auth(request: HttpRequest):
    username = request.session.get("user_name")
    if not username:
        return None, JsonResponse({"error": "auth required"}, status=401)
    return username, None


def get_or_create_user(name: str) -> UserProfile:
    user, _ = UserProfile.objects.get_or_create(name=name)
    return user


def ensure_machine(machine_id: int) -> Machine:
    return Machine.objects.get(pk=machine_id)


@csrf_exempt
def start_machine(request: HttpRequest):
    username, error = _require_auth(request)
    if error:
        return error
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8'))
        machine_id = int(payload['machine_id'])
        cycle_minutes = int(payload.get('cycle_minutes', 45))
    except Exception:
        return JsonResponse({'error': 'invalid payload'}, status=400)

    try:
        machine = ensure_machine(machine_id)
    except Machine.DoesNotExist:
        return JsonResponse({'error': 'machine not found'}, status=404)

    # Enforce 15-minute cooldown after last empty
    if machine.last_emptied_at is not None:
        cooldown_until = machine.last_emptied_at + timedelta(minutes=15)
        now_ts = timezone.now()
        if now_ts < cooldown_until:
            remaining = int((cooldown_until - now_ts).total_seconds() // 60) or 1
            return JsonResponse({'error': 'cooldown', 'cooldown_minutes_left': remaining}, status=409)

    user = get_or_create_user(username)
    ActionLog.objects.create(user=user, machine=machine, action='start')
    UserProfile.objects.filter(pk=user.pk).update(points=F('points') + 1)

    machine.status = 'running'
    # Add 5 minutes extra to all cycles
    machine.ends_at = timezone.now() + timedelta(minutes=cycle_minutes + 5)
    machine.started_by = user
    machine.save(update_fields=['status', 'ends_at', 'started_by'])

    return JsonResponse({'ok': True})


@csrf_exempt
def empty_machine(request: HttpRequest):
    username, error = _require_auth(request)
    if error:
        return error
    if request.method != 'POST':
        return JsonResponse({'error': 'method not allowed'}, status=405)
    try:
        payload = json.loads(request.body.decode('utf-8'))
        machine_id = int(payload['machine_id'])
    except Exception:
        return JsonResponse({'error': 'invalid payload'}, status=400)

    try:
        machine = ensure_machine(machine_id)
    except Machine.DoesNotExist:
        return JsonResponse({'error': 'machine not found'}, status=404)

    user = get_or_create_user(username)
    ActionLog.objects.create(user=user, machine=machine, action='empty')
    UserProfile.objects.filter(pk=user.pk).update(points=F('points') + 5)

    machine.status = 'idle'
    machine.ends_at = None
    machine.started_by = None
    machine.last_emptied_at = timezone.now()
    machine.save(update_fields=['status', 'ends_at', 'started_by', 'last_emptied_at'])

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
    machines = Machine.objects.order_by('id').values('id', 'name', 'status', 'ends_at', 'floor', 'started_by__name', 'last_emptied_at')
    out = []
    now = timezone.now()
    for m in machines:
        remaining_minutes = None
        ready_since_minutes = None
        empty_since_minutes = None
        status = m['status']
        if status == 'running' and m['ends_at']:
            delta = m['ends_at'] - now
            remaining_minutes = max(0, int((delta.total_seconds() + 59) // 60))
            if delta.total_seconds() <= 0:
                status = 'finished'
                remaining_minutes = 0
        if status == 'finished' and m['ends_at']:
            delta_ready = now - m['ends_at']
            ready_since_minutes = max(0, int((delta_ready.total_seconds() + 59) // 60))
        if status == 'idle' and m['last_emptied_at']:
            delta_empty = now - m['last_emptied_at']
            empty_since_minutes = max(0, int((delta_empty.total_seconds() + 59) // 60))
        out.append({
            'id': str(m['id']),
            'name': m['name'],
            'status': status,
            'remaining_minutes': remaining_minutes,
            'ready_since_minutes': ready_since_minutes,
            'empty_since_minutes': empty_since_minutes,
            'floor': m['floor'],
            'started_by': m['started_by__name'],
        })
    return JsonResponse({'machines': out})
