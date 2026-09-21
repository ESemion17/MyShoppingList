export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="טוען"
    />
  )
}

export function FullPageSpinner({ label = 'טוען…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-400">
      <Spinner className="h-8 w-8 text-brand-500" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
