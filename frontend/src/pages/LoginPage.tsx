import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Zap, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Please enter both username and password')
      return
    }

    setLoading(true)
    setError('')

    const result = await login(username, password)
    if (!result.success) {
      setError(result.error || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
           style={{ background: 'linear-gradient(135deg, #0f1729 0%, #1a2744 50%, #0d1b2a 100%)' }}>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-500)' }}>
              <Zap size={22} color="#fff" />
            </div>
            <span className="text-xl font-bold" style={{ color: '#fff' }}>NexusID</span>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Karnataka Business Identity Resolution
          </p>
        </div>

        <div className="space-y-8">
          <h2 className="text-3xl font-bold leading-tight" style={{ color: '#fff' }}>
            Unified business identity<br />
            across 40+ departments
          </h2>
          <div className="space-y-4">
            <StatLine label="Records Resolved" value="2,992" />
            <StatLine label="Model PR-AUC" value="0.999" />
            <StatLine label="False Merge Rate" value="< 1%" />
            <StatLine label="Departments Connected" value="5" />
          </div>
        </div>

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Government of Karnataka — Regulatory Intelligence Platform
        </p>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand-500)' }}>
              <Zap size={22} color="#fff" />
            </div>
            <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>NexusID</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Sign in</h1>
            <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
              Enter your credentials to access the platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm animate-fade-in"
                   style={{ background: 'rgba(242,76,92,0.1)', color: 'var(--danger)', border: '1px solid rgba(242,76,92,0.2)' }}>
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                  outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--brand-500)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm transition-colors"
                  style={{
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                    outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--brand-500)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: loading ? 'var(--brand-600)' : 'var(--brand-500)',
                color: '#fff',
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight size={14} /></>
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 p-4 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Demo Credentials
            </div>
            <div className="space-y-2 text-xs">
              <CredRow user="admin" pass="admin123" role="Full access" onClick={() => { setUsername('admin'); setPassword('admin123') }} />
              <CredRow user="reviewer1" pass="review123" role="Reviewer" onClick={() => { setUsername('reviewer1'); setPassword('review123') }} />
              <CredRow user="viewer" pass="view123" role="Read-only" onClick={() => { setUsername('viewer'); setPassword('view123') }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span className="text-sm font-bold font-mono" style={{ color: '#fff' }}>{value}</span>
    </div>
  )
}

function CredRow({ user, pass, role, onClick }: { user: string; pass: string; role: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors text-left"
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span className="font-mono" style={{ color: 'var(--brand-300)' }}>{user}</span>
      <span className="font-mono">{pass}</span>
      <span style={{ color: 'var(--text-tertiary)' }}>{role}</span>
    </button>
  )
}
