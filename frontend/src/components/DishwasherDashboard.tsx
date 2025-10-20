import React, { useEffect, useMemo, useState } from 'react';
import { emptyMachineApi, getLeaderboardApi, getStateApi, type MachineStateDto, startMachineApi, type LeaderboardEntry } from '../api';

type MachineStatus = 'idle' | 'running' | 'finished';

interface MachineState {
  id: string;
  name: string;
  status: MachineStatus;
  // Remaining minutes if running; null otherwise
  remainingMinutes: number | null;
  // Epoch ms when the cycle ends; null if not running
  endsAt: number | null;
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
  const [userName, setUserName] = useState<string | null>(() => {
    const v = localStorage.getItem(USERNAME_KEY);
    return v && v.trim().length > 0 ? v : null;
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const now = Date.now();
  const needsUserName = !userName;

  // Tick every 15s to update remaining times
  useEffect(() => {
    const timer = setInterval(() => {
      setMachines((prev) => {
        const updated = prev.map((m): MachineState => {
          if (m.status !== 'running' || m.endsAt === null) return m;
          const remainingMs = m.endsAt - Date.now();
          if (remainingMs <= 0) {
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

  // Load leaderboard periodically
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
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

  // Live polling: sync machine state from backend every 5s
  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        const res = await getStateApi();
        if (cancelled) return;
        setMachines((prev) => {
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
            };
          });
          saveToStorage(next);
          return next;
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    }
    sync();
    const t = setInterval(sync, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
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
            }
          : m
      );
      saveToStorage(updated);
      return updated;
    });
    try {
      if (!userName) return;
      await startMachineApi({ machineId: id, cycleMinutes, userName });
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
        m.id === id ? { ...m, status: 'idle' as const, remainingMinutes: null, endsAt: null } : m
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
          <h1 className="title">42 waschingmachine</h1>
          <p className="subtitle">4 dishwashers for the establishment</p>
        </div>
      </header>

      <main className="grid">
        {machines.map((m) => (
          <article key={m.id} className="card" aria-label={`${m.name} card`}>
            <h2 className="machine-title">{m.name}</h2>
            <div className="status" aria-live="polite">
              <span className={`dot ${m.status}`} aria-hidden />
              <span>
                {m.status === 'idle' && 'Idle'}
                {m.status === 'running' &&
                  `Running • ${formatRemaining(m.remainingMinutes ?? 0)} left`}
                {m.status === 'finished' && 'Finished'}
              </span>
            </div>

            <div className="controls">
              {m.status === 'idle' && (
                <>
                  <button className="primary" onClick={() => startMachine(m.id, 15)} aria-label={`Start ${m.name} 15 minutes`}>
                    Start 15m
                  </button>
                  <button className="primary" onClick={() => startMachine(m.id, 30)} aria-label={`Start ${m.name} 30 minutes`}>
                    Start 30m
                  </button>
                  <button className="primary" onClick={() => startMachine(m.id, 45)} aria-label={`Start ${m.name} 45 minutes`}>
                    Start 45m
                  </button>
                </>
              )}
              {m.status === 'running' && (
                <button className="warn" onClick={() => markFinished(m.id)} aria-label={`Mark ${m.name} finished`}>
                  Mark finished
                </button>
              )}
              {m.status === 'finished' && (
                <button className="primary" onClick={async () => {
                  try {
                    if (userName) {
                      await emptyMachineApi({ machineId: m.id, userName });
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
          {leaderboard.map((e) => (
            <li key={e.user} className="leaderboard-item">
              <span className="lb-user">{e.user}</span>
              <span className="lb-points">{e.points} pts</span>
              <span className="lb-starts" aria-label="starts">{e.starts} starts</span>
            </li>
          ))}
          {leaderboard.length === 0 && <li className="leaderboard-empty">No entries yet.</li>}
        </ul>
      </section>

      {needsUserName && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Enter your name">
          <div className="overlay-card">
            <h2 className="overlay-title">Welcome</h2>
            <p className="overlay-subtitle">Please enter your name to participate</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget as HTMLFormElement);
                const name = String(data.get('name') || '');
                saveUserName(name);
              }}
            >
              <input name="name" className="input" placeholder="Your name" autoFocus aria-label="Your name" />
              <button className="primary submit" type="submit">Save</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


