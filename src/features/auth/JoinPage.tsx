import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { setPendingInvite } from './invite'
import { FullPageSpinner } from '@/components/Spinner'

/**
 * Landing for /join?token=xxx.
 * - Not logged in → remember the token, send to /auth.
 * - Logged in without family → send to onboarding (it consumes the token).
 * - Logged in with family → already in, go to the list.
 */
export function JoinPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { session, needsFamily } = useAuth()

  useEffect(() => {
    if (token) setPendingInvite(token)
  }, [token])

  if (!token) return <Navigate to="/" replace />
  if (!session) return <Navigate to="/auth" replace />
  if (needsFamily) return <Navigate to="/onboarding" replace />
  return <FullPageSpinner label="מצטרפים…" />
}
