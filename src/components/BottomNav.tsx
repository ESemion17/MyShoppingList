import { NavLink } from 'react-router-dom'
import { ListIcon, ReceiptIcon, ChartIcon, SettingsIcon } from './icons'

const tabs = [
  { to: '/list', label: 'רשימה', Icon: ListIcon },
  { to: '/receipts', label: 'קבלות', Icon: ReceiptIcon },
  { to: '/budget', label: 'תקציב', Icon: ChartIcon },
  { to: '/settings', label: 'הגדרות', Icon: SettingsIcon },
]

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${
                isActive ? 'text-brand-600' : 'text-slate-400'
              }`
            }
          >
            <Icon className="h-6 w-6" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
