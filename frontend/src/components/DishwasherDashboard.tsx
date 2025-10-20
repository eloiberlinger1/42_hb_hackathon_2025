import React, { useEffect, useMemo, useState } from 'react';

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
  const now = Date.now();

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

  function startMachine(id: string, cycleMinutes: number): void {
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

  const allIdle = useMemo(() => machines.every((m) => m.status === 'idle'), [machines]);

  return (
    <div className="app-shell" role="application" aria-label="42 waschingmachine">
      <header className="header">
        <div>
          <h1 className="title">42 waschingmachine</h1>
          <p className="subtitle">4 dishwashers for the establishment</p>
        </div>
        <button
          className="muted"
          aria-label="Reset all to idle"
          onClick={() => machines.forEach((m) => resetToIdle(m.id))}
          disabled={allIdle}
        >
          Reset all
        </button>
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
              {m.status !== 'running' && (
                <button
                  className="primary"
                  onClick={() => startMachine(m.id, 45)}
                  aria-label={`Start ${m.name} 45 minutes`}
                >
                  Start 45m
                </button>
              )}
              {m.status === 'running' && (
                <button
                  className="warn"
                  onClick={() => markFinished(m.id)}
                  aria-label={`Mark ${m.name} finished`}
                >
                  Mark finished
                </button>
              )}
              <button className="muted" onClick={() => resetToIdle(m.id)} aria-label={`Reset ${m.name} to idle`}>
                Reset
              </button>
            </div>
          </article>
        ))}
      </main>

      <p className="footer-note">Local-only, no server required.</p>
    </div>
  );
}


