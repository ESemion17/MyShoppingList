const KEY = 'msl_pending_invite'

export function setPendingInvite(token: string) {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    /* ignore private-mode storage errors */
  }
}

export function getPendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Build a shareable invite URL for a token. */
export function inviteUrl(token: string): string {
  return `${window.location.origin}/join?token=${encodeURIComponent(token)}`
}
