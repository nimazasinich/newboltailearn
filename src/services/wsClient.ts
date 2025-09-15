import { SystemMetrics } from './api'
import { WS_URL } from '../lib/config'

export type WSEventType = 'system_metrics' | 'training_progress' | 'training_complete'

export interface WSEvent {
  type: WSEventType
  data: any
}

export type WSEventListener = (event: WSEvent) => void

class WSClient {
  private ws: WebSocket | null = null
  private url: string
  private listeners = new Map<WSEventType, Set<WSEventListener>>()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelays = [1000, 2000, 5000, 10000, 10000] // 1s, 2s, 5s, 10s, 10s
  private reconnectTimer: number | null = null
  private isConnecting = false
  private shouldReconnect = true

  constructor(url?: string) {
    this.url = url || WS_URL
  }

  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve()
    }

    this.isConnecting = true
    this.shouldReconnect = true

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log('[WS] Connected to WebSocket server')
          this.isConnecting = false
          this.reconnectAttempts = 0
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
          }
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const wsEvent: WSEvent = JSON.parse(event.data)
            this.emit(wsEvent.type, wsEvent)
          } catch (error) {
            console.error('[WS] Failed to parse message:', error)
          }
        }

        this.ws.onerror = (error) => {
          console.error('[WS] WebSocket error:', error)
          this.isConnecting = false
          if (this.reconnectAttempts === 0) {
            reject(new Error('Failed to connect to WebSocket server'))
          }
        }

        this.ws.onclose = (event) => {
          console.log(`[WS] Connection closed: ${event.code} ${event.reason}`)
          this.isConnecting = false
          this.ws = null

          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect()
          }
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    const delay = this.reconnectDelays[Math.min(this.reconnectAttempts, this.reconnectDelays.length - 1)]
    console.log(`[WS] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect().catch(error => {
        console.error('[WS] Reconnect failed:', error)
      })
    }, delay)
  }

  disconnect() {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
  }

  on(eventType: WSEventType, listener: WSEventListener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(listener)
  }

  off(eventType: WSEventType, listener: WSEventListener) {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.listeners.delete(eventType)
      }
    }
  }

  private emit(eventType: WSEventType, event: WSEvent) {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event)
        } catch (error) {
          console.error(`[WS] Error in event listener for ${eventType}:`, error)
        }
      })
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  get connectionState(): string {
    if (!this.ws) return 'disconnected'
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting'
      case WebSocket.OPEN: return 'connected'
      case WebSocket.CLOSING: return 'closing'
      case WebSocket.CLOSED: return 'closed'
      default: return 'unknown'
    }
  }
}

// Export a singleton instance
export const wsClient = new WSClient()

// Auto-connect when module loads
wsClient.connect().catch(error => {
  console.warn('[WS] Initial connection failed, will retry:', error.message)
})

export default wsClient