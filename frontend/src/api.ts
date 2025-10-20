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

export function startMachineApi(args: { machineId: string; cycleMinutes: number; userName: string }): Promise<{ ok: true }>{
  return request('/api/start', {
    method: 'POST',
    body: JSON.stringify({ machine_id: args.machineId, cycle_minutes: args.cycleMinutes, user_name: args.userName }),
  });
}

export function emptyMachineApi(args: { machineId: string; userName: string }): Promise<{ ok: true }>{
  return request('/api/empty', {
    method: 'POST',
    body: JSON.stringify({ machine_id: args.machineId, user_name: args.userName }),
  });
}

export function getLeaderboardApi(): Promise<{ leaderboard: LeaderboardEntry[] }>{
  return request('/api/leaderboard');
}


