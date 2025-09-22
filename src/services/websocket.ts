import { io, Socket } from 'socket.io-client';

export interface TrainingProgressEvent {
  modelId: number;
  sessionId: number;
  progress: {
    epoch: number;
    loss: number;
    accuracy: number;
    validationLoss?: number;
    validationAccuracy?: number;
    timestamp: string;
    progress: number;
  };
}

export interface TrainingCompleteEvent {
  modelId: number;
  sessionId: number;
  message: string;
  finalAccuracy: number;
  finalLoss: number;
}

export interface TrainingErrorEvent {
  modelId: number;
  sessionId: number;
  error: string;
}

export interface WorkerMetricsEvent {
  memoryUsage: number;
  cpuUsage: number;
  activeWorkers: number;
  totalWorkers: number;
  timestamp: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners = new Map<string, Set<Function>>();

  /**
   * Connect to WebSocket server
   */
  connect(url?: string): void {
    if (this.socket?.connected) {
      return;
    }

    const socketUrl = url || `${window.location.protocol}//${window.location.host}`;
    
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected', true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
        this.emit('connection_failed', error);
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
      this.emit('reconnected', attemptNumber);
    });

    // Training events
    this.socket.on('training_progress', (data: TrainingProgressEvent) => {
      this.emit('training_progress', data);
    });

    this.socket.on('training_completed', (data: TrainingCompleteEvent) => {
      this.emit('training_complete', data);
    });

    this.socket.on('training_failed', (data: TrainingErrorEvent) => {
      this.emit('training_error', data);
    });

    this.socket.on('training_stopped', (data: { modelId: number }) => {
      this.emit('training_stopped', data);
    });

    // Worker metrics
    this.socket.on('worker_metrics', (data: WorkerMetricsEvent) => {
      this.emit('worker_metrics', data);
    });

    // System events
    this.socket.on('system_status', (data: any) => {
      this.emit('system_status', data);
    });

    this.socket.on('model_updated', (data: any) => {
      this.emit('model_updated', data);
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket event callback:', error);
        }
      });
    }
  }

  /**
   * Send message to server
   */
  send(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected. Message not sent:', event, data);
    }
  }

  /**
   * Join room
   */
  joinRoom(room: string): void {
    this.send('join', { room });
  }

  /**
   * Leave room
   */
  leaveRoom(room: string): void {
    this.send('leave', { room });
  }

  /**
   * Subscribe to model training updates
   */
  subscribeToModel(modelId: number): void {
    this.joinRoom(`model_${modelId}`);
  }

  /**
   * Unsubscribe from model training updates
   */
  unsubscribeFromModel(modelId: number): void {
    this.leaveRoom(`model_${modelId}`);
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket ID
   */
  get socketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Get reconnection attempts
   */
  get reconnectionAttempts(): number {
    return this.reconnectAttempts;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();

// Auto-connect when the service is imported
if (typeof window !== 'undefined') {
  websocketService.connect();
}

export default websocketService;