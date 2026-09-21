import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFamilyData } from '@/contexts/FamilyDataContext'
import { PageHeader } from '@/components/AppLayout'
import { Spinner } from '@/components/Spinner'
import { CopyIcon, LogoutIcon, PlusIcon, TrashIcon } from '@/components/icons'
import { inviteUrl } from '@/features/auth/invite'

export function SettingsPage() {
  const { family, profile, session, signOut } = useAuth()
  const { categories, members, addCategory, deleteCategory } = useFamilyData()

  const [newCat, setNewCat] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [invite, setInvite] = useState<string | null>(null)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createInvite = async () => {
    setCreatingInvite(true)
    setError(null)
    try {
      const token = crypto.randomUUID().replace(/-/g, '')
      const expires = new Date()
      expires.setDate(expires.getDate() + 14)
      const { error: err } = await supabase.from('family_invites').insert({
        family_id: family!.id,
        token,
        created_by: profile?.id ?? null,
        expires_at: expires.toISOString(),
      })
      if (err) throw err
      setInvite(inviteUrl(token))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת ההזמנה')
    } finally {
      setCreatingInvite(false)
    }
  }

  const share = async () => {
    if (!invite) return
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'הצטרפות למשפחה ב-MyShoppingList', url: invite })
        return
      } catch {
        /* user cancelled — fall back to copy */
      }
    }
    await navigator.clipboard.writeText(invite)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addCat = async () => {
    if (!newCat.trim()) return
    setAddingCat(true)
    try {
      await addCategory(newCat)
      setNewCat('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה')
    } finally {
      setAddingCat(false)
    }
  }

  return (
    <div className="pb-6">
      <PageHeader title="הגדרות" subtitle={family?.name} />

      {/* family / members */}
      <section className="card mx-4 mt-4 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">בני המשפחה</h3>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {(m.display_name ?? '?').slice(0, 1)}
              </div>
              <span className="text-sm text-slate-700">
                {m.display_name || 'ללא שם'}
                {m.id === session?.user.id && (
                  <span className="ms-1 text-xs text-slate-400">(את/ה)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* invite */}
      <section className="card mx-4 mt-3 p-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">הזמנת בן משפחה</h3>
        <p className="mb-3 text-xs text-slate-400">
          צור קישור אישי ושלח אותו. מי שנרשם דרכו יצטרף למשפחה. הקישור תקף 14 יום.
        </p>
        {invite ? (
          <div className="space-y-2">
            <div className="ltr-nums break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              {invite}
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={share}>
                <CopyIcon className="h-4 w-4" />
                {copied ? 'הועתק!' : typeof navigator.share === 'function' ? 'שיתוף' : 'העתקה'}
              </button>
              <button className="btn-secondary" onClick={createInvite} disabled={creatingInvite}>
                קישור חדש
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-primary w-full" onClick={createInvite} disabled={creatingInvite}>
            {creatingInvite && <Spinner className="h-4 w-4" />}
            צור קישור הזמנה
          </button>
        )}
      </section>

      {/* categories */}
      <section className="card mx-4 mt-3 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">קטגוריות</h3>
        <div className="mb-3 flex gap-2">
          <input
            className="input flex-1"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCat()}
            placeholder="קטגוריה חדשה (למשל: חלב וביצים)"
          />
          <button className="btn-primary px-3" onClick={addCat} disabled={addingCat}>
            {addingCat ? <Spinner className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="text-xs text-slate-400">אין קטגוריות עדיין.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id} className="chip bg-slate-100 text-slate-600">
                {c.name}
                <button
                  className="text-slate-300 hover:text-red-500"
                  onClick={() => deleteCategory(c.id)}
                  aria-label={`מחק ${c.name}`}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="mt-3 px-4 text-center text-sm text-red-600">{error}</p>}

      <button className="btn-ghost mx-auto mt-6 flex text-red-500" onClick={signOut}>
        <LogoutIcon className="h-4 w-4" />
        התנתקות
      </button>

      <p className="mt-4 text-center text-xs text-slate-300">MyShoppingList · גרסה 0.1</p>
    </div>
  )
}
