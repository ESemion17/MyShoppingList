import { useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/Spinner'

type Mode = 'signin' | 'signup'

export function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        if (!displayName.trim()) throw new Error('נא להזין שם')
        await signUp(email.trim(), password, displayName.trim())
        setInfo(
          'נרשמת! אם הופעל אישור מייל בפרויקט — בדוק את תיבת הדואר. אחרת אפשר להתחבר עכשיו.',
        )
        setMode('signin')
      } else {
        await signIn(email.trim(), password)
      }
    } catch (err) {
      setError(translateAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg">
          <img src="/icon.svg" alt="" className="h-16 w-16" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">MyShoppingList</h1>
        <p className="mt-1 text-sm text-slate-400">רשימת קניות והוצאות משפחתית</p>
      </div>

      <div className="card p-5">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
          <button
            className={`rounded-lg py-2 transition ${
              mode === 'signin' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => setMode('signin')}
          >
            התחברות
          </button>
          <button
            className={`rounded-lg py-2 transition ${
              mode === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => setMode('signup')}
          >
            הרשמה
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">שם לתצוגה</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="איך שיקראו לך במשפחה"
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">אימייל</label>
            <input
              className="input ltr-nums text-right"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              dir="ltr"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">סיסמה</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="לפחות 6 תווים"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}

          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Spinner className="h-4 w-4" />}
            {mode === 'signin' ? 'התחברות' : 'יצירת חשבון'}
          </button>
        </form>
      </div>
    </div>
  )
}

function translateAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/Invalid login credentials/i.test(msg)) return 'אימייל או סיסמה שגויים'
  if (/already registered/i.test(msg)) return 'האימייל כבר רשום — נסה להתחבר'
  if (/Password should be/i.test(msg)) return 'הסיסמה קצרה מדי (לפחות 6 תווים)'
  if (/Email not confirmed/i.test(msg)) return 'המייל טרם אושר — בדוק את תיבת הדואר'
  return msg
}
