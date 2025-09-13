import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (token: string, user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

interface AppState {
  // WebSocket connection
  socketConnected: boolean;
  socketReconnectAttempt: number;
  
  // Training state
  activeTraining: {
    modelId: number;
    progress: number;
    epoch: number;
    loss: number;
    accuracy: number;
  } | null;
  
  // UI state
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>;
  
  // Actions
  setSocketConnected: (connected: boolean) => void;
  setSocketReconnectAttempt: (attempt: number) => void;
  setActiveTraining: (training: AppState['activeTraining']) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// Auth store with persistence
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        
        login: (token, user) => set({
          token,
          user,
          isAuthenticated: true,
          error: null
        }),
        
        logout: () => set({
          token: null,
          user: null,
          isAuthenticated: false,
          error: null
        }),
        
        setLoading: (loading) => set({ isLoading: loading }),
        
        setError: (error) => set({ error }),
        
        clearError: () => set({ error: null })
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated
        })
      }
    )
  )
);

// App store for global UI state
export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        socketConnected: false,
        socketReconnectAttempt: 0,
        activeTraining: null,
        sidebarOpen: true,
        theme: 'light',
        notifications: [],
        
        setSocketConnected: (connected) => set({ 
          socketConnected: connected,
          socketReconnectAttempt: connected ? 0 : (state) => state.socketReconnectAttempt
        }),
        
        setSocketReconnectAttempt: (attempt) => set({ socketReconnectAttempt: attempt }),
        
        setActiveTraining: (training) => set({ activeTraining: training }),
        
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        
        setTheme: (theme) => {
          set({ theme });
          // Apply theme to document
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        },
        
        addNotification: (notification) => set((state) => ({
          notifications: [
            ...state.notifications,
            {
              ...notification,
              id: Math.random().toString(36).substr(2, 9),
              timestamp: Date.now()
            }
          ].slice(-10) // Keep only last 10 notifications
        })),
        
        removeNotification: (id) => set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        })),
        
        clearNotifications: () => set({ notifications: [] })
      }),
      {
        name: 'app-storage',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          theme: state.theme
        })
      }
    )
  )
);

// Selectors
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectUser = (state: AuthState) => state.user;
export const selectToken = (state: AuthState) => state.token;
export const selectAuthError = (state: AuthState) => state.error;

export const selectSocketStatus = (state: AppState) => ({
  connected: state.socketConnected,
  reconnectAttempt: state.socketReconnectAttempt
});

export const selectActiveTraining = (state: AppState) => state.activeTraining;
export const selectNotifications = (state: AppState) => state.notifications;
export const selectTheme = (state: AppState) => state.theme;