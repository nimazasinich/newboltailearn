// Simple useAuth hook for authentication state
import { useState, useEffect } from 'react'

interface AuthState {
  isAuthenticated: boolean
  user: any | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true
  })

  useEffect(() => {
    // Simple check for auth token
    const token = localStorage.getItem('token')
    setAuthState({
      isAuthenticated: !!token,
      user: token ? { id: 1, name: 'User' } : null,
      loading: false
    })
  }, [])

  return authState
}