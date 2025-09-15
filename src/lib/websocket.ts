import { WS_PATH } from './config'

export type WSMessage = { type: string; data: any; timestamp?: number }

export class WSClient {
  ws: WebSocket | null = null
  listeners = new Map<string, Set<(data: any)=>void>>()
  attempts = 0
  max = 5

  url(): string {
    const base = WS_PATH.startsWith('/') ? `${location.protocol==='https:'?'wss:':'ws:'}//${location.host}${WS_PATH}` : WS_PATH
    return base
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url())
        this.ws.onopen = () => { this.attempts = 0; resolve() }
        this.ws.onmessage = ev => { try { const m = JSON.parse(ev.data) as WSMessage; this.emit(m) } catch(e){ /* ignore parse errors */ } }
        this.ws.onclose = () => { this.reconnect() }
        this.ws.onerror = err => { reject(err) }
      } catch (e) { reject(e) }
    })
  }

  reconnect() {
    if (this.attempts >= this.max) return
    this.attempts++
    setTimeout(() => this.connect().catch(()=>{}), this.attempts*1000)
  }

  on(type: string, cb: (data:any)=>void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(cb)
    return () => this.listeners.get(type)!.delete(cb)
  }

  emit(m: WSMessage) {
    const set = this.listeners.get(m.type)
    if (set) set.forEach(cb => cb(m.data))
    const all = this.listeners.get('*')
    if (all) all.forEach(cb => cb(m))
  }

  send(type: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type, data, timestamp: Date.now() }))
  }

  get connected() { return this.ws?.readyState === WebSocket.OPEN }
}

export const wsClient = new WSClient()