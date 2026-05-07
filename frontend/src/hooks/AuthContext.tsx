import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface User {
  username: string
  full_name: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthState>({
  user: null, token: null, isAuthenticated: false,
  login: async () => ({ success: false }), logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Restore from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('nexusid-auth')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setToken(parsed.token)
        setUser(parsed.user)
        // Verify token is still valid
        fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${parsed.token}` },
        }).then(r => r.json()).then(data => {
          if (!data.valid) {
            setToken(null)
            setUser(null)
            sessionStorage.removeItem('nexusid-auth')
          }
        }).catch(() => {})
      } catch { sessionStorage.removeItem('nexusid-auth') }
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const err = await res.json()
        return { success: false, error: err.detail || 'Login failed' }
      }

      const data = await res.json()
      setToken(data.access_token)
      setUser({ username: data.username, full_name: data.full_name, role: data.role })
      sessionStorage.setItem('nexusid-auth', JSON.stringify({
        token: data.access_token,
        user: { username: data.username, full_name: data.full_name, role: data.role },
      }))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' }
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    sessionStorage.removeItem('nexusid-auth')
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token && !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
