import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/Spinner'
import { clearPendingInvite, getPendingInvite } from './invite'
import { LogoutIcon } from '@/components/icons'

type Tab = 'create' | 'join'

export function OnboardingPage() {
  const { createFamily, joinFamily, signOut, profile } = useAuth()
  const pending = getPendingInvite()
  const [tab, setTab] = useState<Tab>(pending ? 'join' : 'create')
  const [name, setName] = useState('')
  const [token, setToken] = useState(pending ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If arriving via an invite link, try to join automatically once.
  useEffect(() => {
    if (!pending) return
    let cancelled = false
    setLoading(true)
    joinFamily(pending)
      .then(() => clearPendingInvite())
      .catch((err) => {
        if (!cancelled) setError(translateJoinError(err))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('נא להזין שם למשפחה')
    setLoading(true)
    try {
      await createFamily(name.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת המשפחה')
    } finally {
      setLoading(false)
    }
  }

  const doJoin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!token.trim()) return setError('נא להדביק קוד/קישור הזמנה')
    setLoading(true)
    try {
      await joinFamily(extractToken(token.trim()))
      clearPendingInvite()
    } catch (err) {
      setError(translateJoinError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">
          שלום {profile?.display_name || ''} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          כדי להתחיל, צור משפחה חדשה או הצטרף לקיימת דרך קישור הזמנה.
        </p>
      </div>

      <div className="card p-5">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
          <button
            className={`rounded-lg py-2 transition ${
              tab === 'create' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => setTab('create')}
          >
            משפחה חדשה
          </button>
          <button
            className={`rounded-lg py-2 transition ${
              tab === 'join' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
            onClick={() => setTab('join')}
          >
            הצטרפות
          </button>
        </div>

        {tab === 'create' ? (
          <form onSubmit={doCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">שם המשפחה</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: משפחת כהן"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading && <Spinner className="h-4 w-4" />}
              יצירת משפחה
            </button>
          </form>
        ) : (
          <form onSubmit={doJoin} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                קישור או קוד הזמנה
              </label>
              <input
                className="input ltr-nums text-right"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="הדבק כאן את הקישור שקיבלת"
                dir="ltr"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading && <Spinner className="h-4 w-4" />}
              הצטרפות למשפחה
            </button>
          </form>
        )}
      </div>

      <button className="btn-ghost mx-auto mt-6 text-slate-400" onClick={signOut}>
        <LogoutIcon className="h-4 w-4" />
        התנתקות
      </button>
    </div>
  )
}

function extractToken(input: string): string {
  // accept a full URL (…/join?token=xxx) or a bare token
  try {
    const url = new URL(input)
    return url.searchParams.get('token') ?? input
  } catch {
    return input
  }
}

function translateJoinError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/invalid_token|not found/i.test(msg)) return 'קוד ההזמנה אינו תקין'
  if (/expired/i.test(msg)) return 'קוד ההזמנה פג תוקף'
  if (/used/i.test(msg)) return 'קוד ההזמנה כבר נוצל'
  if (/already/i.test(msg)) return 'כבר שייך למשפחה'
  return msg
}
