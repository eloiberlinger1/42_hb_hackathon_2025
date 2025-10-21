import React, { useEffect, useMemo, useState } from 'react';
import { emptyMachineApi, getLeaderboardApi, getMe, getStateApi, type MachineStateDto, startMachineApi, type LeaderboardEntry } from '../api';

type MachineStatus = 'idle' | 'running' | 'finished';

const AUTH_URL = "/api/auth/login/";
const NOTIF_ASKED_KEY = 'notifications:asked';
const NOTIF_ENABLED_KEY = 'notifications:enabled';


interface MachineState {
  id: string;
  name: string;
  status: MachineStatus;
  // Remaining minutes if running; null otherwise
  remainingMinutes: number | null;
  // Epoch ms when the cycle ends; null if not running
  endsAt: number | null;
  // Name of the user who started the current cycle; null if none
  startedBy: string | null;
  readySince: number | null;
  emptySince: number | null;
}

const STORAGE_KEY = 'dishwashers:v1';
const USERNAME_KEY = 'dishwashers:username';

function initialMachines(): MachineState[] {
  return [1, 2, 3, 4].map((n) => ({
    id: String(n),
    name: `Dishwasher ${n}`,
    status: 'idle',
    remainingMinutes: null,
    endsAt: null,
    startedBy: null,
    readySince: null,
    emptySince: null,
  }));
}

function loadFromStorage(): MachineState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialMachines();
    const parsed = JSON.parse(raw) as MachineState[];
    // Validate minimal shape
    if (!Array.isArray(parsed) || parsed.length !== 4) return initialMachines();
    return parsed;
  } catch {
    return initialMachines();
  }
}

function saveToStorage(machines: MachineState[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(machines));
}

function formatRemaining(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

export function DishwasherDashboard(): React.ReactElement {
  const [machines, setMachines] = useState<MachineState[]>(() => loadFromStorage());
  const [userName, setUserName] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const now = Date.now();
  const needsUserName = !userName;

  function isNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  function sendReadyNotification(machineName: string): void {
    try {
      if (!isNotificationSupported()) return;
      const enabled = localStorage.getItem(NOTIF_ENABLED_KEY) === 'true';
      if (!enabled || Notification.permission !== 'granted') return;
      // Best-effort; icon optional
      new Notification('Dishwasher finished', {
        body: `${machineName} is ready to empty`,
      });
    } catch {
      // ignore notification errors
    }
  }

  async function maybeRequestNotificationPermission(): Promise<void> {
    try {
      if (!isNotificationSupported()) return;
      const alreadyAsked = localStorage.getItem(NOTIF_ASKED_KEY) === 'true';
      if (Notification.permission === 'granted') {
        localStorage.setItem(NOTIF_ENABLED_KEY, 'true');
        if (!alreadyAsked) localStorage.setItem(NOTIF_ASKED_KEY, 'true');
        return;
      }
      if (Notification.permission === 'denied') {
        localStorage.setItem(NOTIF_ENABLED_KEY, 'false');
        if (!alreadyAsked) localStorage.setItem(NOTIF_ASKED_KEY, 'true');
        return;
      }
      if (!alreadyAsked) {
        const res = await Notification.requestPermission();
        localStorage.setItem(NOTIF_ASKED_KEY, 'true');
        localStorage.setItem(NOTIF_ENABLED_KEY, res === 'granted' ? 'true' : 'false');
      }
    } catch {
      // ignore permission errors
    }
  }

  // Tick every 15s to update remaining times
  useEffect(() => {
    const timer = setInterval(() => {
      let justFinished: string[] = [];
      setMachines((prev) => {
        const updated = prev.map((m): MachineState => {
          if (m.status !== 'running' || m.endsAt === null) return m;
          const remainingMs = m.endsAt - Date.now();
          if (remainingMs <= 0) {
            justFinished.push(m.name);
            return {
              ...m,
              status: 'finished' as const,
              remainingMinutes: 0,
              endsAt: null,
            };
          }
          return {
            ...m,
            remainingMinutes: Math.ceil(remainingMs / 60000),
          };
        });
        saveToStorage(updated);
        return updated;
      });
      if (justFinished.length > 0) {
        // Defer side-effect out of state update microtask
        setTimeout(() => {
          justFinished.forEach((name) => sendReadyNotification(name));
        }, 0);
      }
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Restore running states on mount to recalc remaining
  useEffect(() => {
    setMachines((prev) => {
      const updated = prev.map((m): MachineState => {
        if (m.status !== 'running' || m.endsAt === null) return m;
        const remainingMs = m.endsAt - now;
        if (remainingMs <= 0) {
          return { ...m, status: 'finished' as const, remainingMinutes: 0, endsAt: null };
        }
        return { ...m, remainingMinutes: Math.ceil(remainingMs / 60000) };
      });
      saveToStorage(updated);
      return updated;
    });
  }, []);

  // Load session and leaderboard periodically
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const me = await getMe();
        if (!cancelled) setUserName(me.authenticated ? me.user?.name ?? null : null);
        if (!cancelled && me.authenticated) {
          // Ask for notifications on first successful login
          void maybeRequestNotificationPermission();
        }
        const res = await getLeaderboardApi();
        if (!cancelled) setLeaderboard(res.leaderboard);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // One-time sync from backend on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getStateApi();
        if (cancelled) return;
        setMachines(() => {
          const next: MachineState[] = res.machines.map((s: MachineStateDto) => {
            let endsAt: number | null = null;
            let remaining: number | null = null;
            if (s.status === 'running' && s.remaining_minutes != null) {
              remaining = s.remaining_minutes;
              endsAt = Date.now() + remaining * 60000;
            } else if (s.status === 'finished') {
              remaining = 0;
            }
            return {
              id: s.id,
              name: s.name,
              status: s.status,
              remainingMinutes: remaining,
              endsAt,
              startedBy: s.started_by ?? null,
              readySince: s.ready_since_minutes ?? null,
              emptySince: s.empty_since_minutes ?? null,
            };
          });
          saveToStorage(next);
          return next;
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function startMachine(id: string, cycleMinutes: number): Promise<void> {
    const end = Date.now() + cycleMinutes * 60000;
    setMachines((prev) => {
      const updated = prev.map((m): MachineState =>
        m.id === id
          ? {
              ...m,
              status: 'running' as const,
              remainingMinutes: cycleMinutes,
              endsAt: end,
              startedBy: userName ?? null,
            }
          : m
      );
      saveToStorage(updated);
      return updated;
    });
    try {
      if (!userName) return;
      await startMachineApi({ machineId: id, cycleMinutes });
      const res = await getLeaderboardApi();
      setLeaderboard(res.leaderboard);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  function markFinished(id: string): void {
    setMachines((prev) => {
      const updated = prev.map((m): MachineState =>
        m.id === id ? { ...m, status: 'finished' as const, remainingMinutes: 0, endsAt: null } : m
      );
      saveToStorage(updated);
      return updated;
    });
  }

  function resetToIdle(id: string): void {
    setMachines((prev) => {
      const updated = prev.map((m): MachineState =>
        m.id === id
          ? { ...m, status: 'idle' as const, remainingMinutes: null, endsAt: null, startedBy: null }
          : m
      );
      saveToStorage(updated);
      return updated;
    });
  }

  function saveUserName(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    localStorage.setItem(USERNAME_KEY, trimmed);
    setUserName(trimmed);
  }

  return (
    <div className="app-shell" role="application" aria-label="42 waschingmachine">
      <header className="header">
        <div>
          <h1 className="title">42 DishHero<span className="suffix">.sh</span></h1>
          <p className="subtitle">4 dishwashers for the establishment</p>
        </div>
      </header>

      <main className="stack">
        <div className="section-title">Second floor</div>
        {/* Second floor (machines 1-2) */}
        {machines.slice(0, 2).map((m) => (
          <article key={m.id} className="card" aria-label={`${m.name} card`}>
            <h2 className="machine-title">{m.name}</h2>
            <div className="status" aria-live="polite">
              <span className={`dot ${m.status}`} aria-hidden />
              <span>
                {m.status === 'idle' && (m.emptySince != null ? `Empty • ${formatRemaining(m.emptySince)} ago` : 'Idle')}
                {m.status === 'running' && (
                  <>
                    Running • {formatRemaining(m.remainingMinutes ?? 0)} left
                    {m.startedBy && <span style={{ marginLeft: 6, color: 'var(--muted)' }}>by {m.startedBy}</span>}
                  </>
                )}
                {m.status === 'finished' && (
                  <>Ready • {formatRemaining(m.readySince ?? 0)} ago</>
                )}
              </span>
            </div>

            <div className="controls">
              {m.status === 'idle' && (
                <div className="cycles">
                  <button className="primary" disabled={m.emptySince != null && m.emptySince < 15} onClick={() => startMachine(m.id, 15)} aria-label={`Start ${m.name} 15 minutes`}>Start 15m</button>
                  <button className="primary" onClick={() => startMachine(m.id, 30)} aria-label={`Start ${m.name} 30 minutes`}>Start 30m</button>
                  <button className="primary" onClick={() => startMachine(m.id, 45)} aria-label={`Start ${m.name} 45 minutes`}>Start 45m</button>
                </div>
              )}
              {/* Removed mark finished UI */}
              {m.status === 'finished' && (
                <button className="primary" onClick={async () => {
                  try {
                    if (userName) {
                      await emptyMachineApi({ machineId: m.id });
                      const res = await getLeaderboardApi();
                      setLeaderboard(res.leaderboard);
                    }
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error(e);
                  } finally {
                    resetToIdle(m.id);
                  }
                }} aria-label={`Empty ${m.name}`}>
                  Empty it
                </button>
              )}
            </div>
          </article>
        ))}
        <div className="section-title">First floor</div>
        {/* First floor (machines 3-4) */}
        {machines.slice(2, 4).map((m) => (
          <article key={m.id} className="card" aria-label={`${m.name} card`}>
            <h2 className="machine-title">{m.name}</h2>
            <div className="status" aria-live="polite">
              <span className={`dot ${m.status}`} aria-hidden />
              <span>
                {m.status === 'idle' && (m.emptySince != null ? `Empty • ${formatRemaining(m.emptySince)} ago` : 'Idle')}
                {m.status === 'running' && (
                  <>
                    Running • {formatRemaining(m.remainingMinutes ?? 0)} left
                    {m.startedBy && <span style={{ marginLeft: 6, color: 'var(--muted)' }}>by {m.startedBy}</span>}
                  </>
                )}
                {m.status === 'finished' && (
                  <>Ready • {formatRemaining(m.readySince ?? 0)} ago</>
                )}
              </span>
            </div>

            <div className="controls">
              {m.status === 'idle' && (
                <div className="cycles">
                  <button className="primary" disabled={m.emptySince != null && m.emptySince < 15} onClick={() => startMachine(m.id, 15)} aria-label={`Start ${m.name} 15 minutes`}>Start 15m</button>
                  <button className="primary" onClick={() => startMachine(m.id, 30)} aria-label={`Start ${m.name} 30 minutes`}>Start 30m</button>
                  <button className="primary" onClick={() => startMachine(m.id, 45)} aria-label={`Start ${m.name} 45 minutes`}>Start 45m</button>
                </div>
              )}
              {/* Removed mark finished UI */}
              {m.status === 'finished' && (
                <button className="primary" onClick={async () => {
                  try {
                    if (userName) {
                      await emptyMachineApi({ machineId: m.id });
                      const res = await getLeaderboardApi();
                      setLeaderboard(res.leaderboard);
                    }
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error(e);
                  } finally {
                    resetToIdle(m.id);
                  }
                }} aria-label={`Empty ${m.name}`}>
                  Empty it
                </button>
              )}
            </div>
          </article>
        ))}
      </main>

      <section className="leaderboard" aria-label="Leaderboard">
        <h3 className="leaderboard-title">Leaderboard</h3>
        <ul className="leaderboard-list">
          {leaderboard.map((e, idx) => (
            <li key={e.user} className="leaderboard-item">
              <span className={`trophy ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''}</span>
              <span className="lb-user">{e.user}</span>
              <span className="lb-points">{e.points} pts</span>
              <span className="lb-starts" aria-label="starts">{e.starts} starts</span>
            </li>
          ))}
          {leaderboard.length === 0 && <li className="leaderboard-empty">No entries yet.</li>}
        </ul>
      </section>

      {needsUserName && (
  <div className="overlay" role="dialog" aria-modal="true" aria-label="Login with 42">
    <div className="overlay-card">
      <h2 className="overlay-title">Welcome</h2>
      <p className="overlay-subtitle">Log in using your 42 Intra account to participate</p>
      <a href={AUTH_URL}>
        <button className="primary submit" type="button">
          Login with 42
        </button>
      </a>
    </div>
  </div>
)}

    </div>
  );
}


