export interface LeaderboardEntry {
  user: string;
  starts: number;
  points: number;
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export function startMachineApi(args: { machineId: string; cycleMinutes: number }): Promise<{ ok: true }>{
  return request('/api/start', {
    method: 'POST',
    body: JSON.stringify({ machine_id: args.machineId, cycle_minutes: args.cycleMinutes }),
  });
}

export function emptyMachineApi(args: { machineId: string }): Promise<{ ok: true }>{
  return request('/api/empty', {
    method: 'POST',
    body: JSON.stringify({ machine_id: args.machineId }),
  });
}

export function getLeaderboardApi(): Promise<{ leaderboard: LeaderboardEntry[] }>{
  return request('/api/leaderboard');
}

export interface MachineStateDto {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'finished';
  remaining_minutes: number | null;
  floor: 'second floor' | 'floor' | string;
  started_by?: string | null;
  ready_since_minutes?: number | null;
  empty_since_minutes?: number | null;
}

export function getStateApi(): Promise<{ machines: MachineStateDto[] }>{
  return request('/api/state');
}

export interface AuthMeResponse {
  authenticated: boolean;
  user?: { name: string };
}

export function getMe(): Promise<AuthMeResponse> {
  return request('/api/auth/me/');
}


