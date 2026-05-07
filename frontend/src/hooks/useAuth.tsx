import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  username: string
  full_name: string | null
  role: string
  access_token: string
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => ({ success: false }),
  logout: () => {},
  isAuthenticated: false,
  isAdmin: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('nexusid-auth')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Verify token on mount
  useEffect(() => {
    if (user?.access_token) {
      fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${user.access_token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (!data.valid) {
            setUser(null)
            localStorage.removeItem('nexusid-auth')
          }
        })
        .catch(() => {})
    }
  }, [])

  const login = async (username: string, password: string) => {
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
      const userData: User = {
        username: data.username,
        full_name: data.full_name,
        role: data.role,
        access_token: data.access_token,
      }

      setUser(userData)
      localStorage.setItem('nexusid-auth', JSON.stringify(userData))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' }
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('nexusid-auth')
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
