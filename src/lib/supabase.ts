import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud & early with a Hebrew hint — the app cannot work without these.
  throw new Error(
    'חסרים משתני סביבה של Supabase. ' +
      'העתק את .env.local.example ל-.env.local ומלא את VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 5 },
  },
})

export const RECEIPTS_BUCKET = 'receipts'
