import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'trainer' | 'viewer' | 'user';
  permissions?: string[];
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,

      login: async (credentials) => {
        set({ loading: true, error: null });
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
          }

          const data = await response.json();
          
          set({
            isAuthenticated: true,
            user: data.user,
            token: data.token,
            loading: false,
            error: null
          });

          // Store token in localStorage for API calls
          localStorage.setItem('auth_token', data.token);
          
        } catch (error) {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Login failed'
          });
          throw error;
        }
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          error: null
        });
        
        // Clear token from localStorage
        localStorage.removeItem('auth_token');
        
        // Redirect to login
        window.location.href = '/login';
      },

      checkAuth: async () => {
        const token = get().token || localStorage.getItem('auth_token');
        
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null });
          return;
        }

        try {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            throw new Error('Authentication check failed');
          }

          const data = await response.json();
          
          set({
            isAuthenticated: true,
            user: data.user,
            token,
            error: null
          });
          
        } catch (error) {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            error: null
          });
          localStorage.removeItem('auth_token');
        }
      },

      updateProfile: async (updates) => {
        const token = get().token;
        
        if (!token) {
          throw new Error('Not authenticated');
        }

        set({ loading: true, error: null });
        
        try {
          const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updates)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Profile update failed');
          }

          const data = await response.json();
          
          set({
            user: data.user,
            loading: false,
            error: null
          });
          
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Profile update failed'
          });
          throw error;
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        const token = get().token;
        
        if (!token) {
          throw new Error('Not authenticated');
        }

        set({ loading: true, error: null });
        
        try {
          const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Password change failed');
          }

          set({
            loading: false,
            error: null
          });
          
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Password change failed'
          });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

// Helper hook for checking permissions
export const usePermission = (permission: string) => {
  const user = useAuthStore(state => state.user);
  
  if (!user) return false;
  
  // Admin has all permissions
  if (user.role === 'admin') return true;
  
  // Check specific permissions
  return user.permissions?.includes(permission) || false;
};

// Helper hook for checking role
export const useRole = (requiredRole: 'admin' | 'trainer' | 'viewer' | 'user') => {
  const user = useAuthStore(state => state.user);
  
  if (!user) return false;
  
  const roleHierarchy: Record<string, number> = {
    'user': 1,
    'viewer': 2,
    'trainer': 3,
    'admin': 4
  };
  
  const userRoleLevel = roleHierarchy[user.role] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
  
  return userRoleLevel >= requiredRoleLevel;
};