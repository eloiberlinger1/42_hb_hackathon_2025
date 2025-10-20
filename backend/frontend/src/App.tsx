import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useSearchParams } from 'react-router-dom'

const API_BASE = 'http://localhost:8000/api'

export type Machine = {
  id: number
  name: string
  is_active: boolean
  active_cycle: null | {
    id: number
    started_at: string
    expected_end_at: string | null
  }
}

function useSSE(url: string, onMessage: (event: MessageEvent) => void) {
  useEffect(() => {
    const es = new EventSource(url)
    es.onmessage = onMessage
    es.addEventListener('cycle_finished', onMessage)
    es.addEventListener('cycle_started', onMessage)
    return () => es.close()
  }, [url, onMessage])
}

function App() {
  const [machines, setMachines] = useState<Machine[]>([])
  const sseUrl = useMemo(() => `${API_BASE}/sse`, [])
  const [searchParams, setSearchParams] = useSearchParams()

  const refresh = async () => {
    const res = await axios.get<Machine[]>(`${API_BASE}/machines`)
    setMachines(res.data)
  }

  useEffect(() => {
    refresh()
  }, [])

  useSSE(sseUrl, () => {
    refresh()
  })

  const start = async (id: number) => {
    await axios.post(`${API_BASE}/machines/${id}/start`, {})
    await refresh()
  }
  const end = async (id: number) => {
    await axios.post(`${API_BASE}/machines/${id}/end`, {})
    await refresh()
  }

  useEffect(() => {
    const machineParam = searchParams.get('machine')
    if (machineParam) {
      const id = parseInt(machineParam, 10)
      if (!Number.isNaN(id)) {
        start(id).finally(() => setSearchParams(params => { params.delete('machine'); return params }))
      }
    }
  }, [searchParams])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1>Laundry Dashboard</h1>
      <p>Scan du QR peut pointer vers /?machine=<id> pour démarrer rapidement.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {machines.map(m => (
          <div key={m.id} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{m.name}</strong>
              {m.active_cycle ? (
                <span style={{ color: 'green' }}>Running</span>
              ) : (
                <span style={{ color: 'gray' }}>Idle</span>
              )}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => start(m.id)} disabled={!!m.active_cycle}>Start</button>
              <button onClick={() => end(m.id)} disabled={!m.active_cycle}>End</button>
            </div>
            {m.active_cycle && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
                Started at: {new Date(m.active_cycle.started_at).toLocaleTimeString()} · Expected: {m.active_cycle.expected_end_at ? new Date(m.active_cycle.expected_end_at).toLocaleTimeString() : 'N/A'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
