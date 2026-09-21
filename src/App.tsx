import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { FamilyDataProvider } from '@/contexts/FamilyDataContext'
import { FullPageSpinner } from '@/components/Spinner'
import { AppLayout } from '@/components/AppLayout'
import { AuthPage } from '@/features/auth/AuthPage'
import { OnboardingPage } from '@/features/auth/OnboardingPage'
import { JoinPage } from '@/features/auth/JoinPage'
import { ListPage } from '@/features/list/ListPage'
import { ReceiptsPage } from '@/features/receipts/ReceiptsPage'

// Code-split the heavier screens (recharts / confirm editor) into their own chunks.
const ReceiptDetailPage = lazy(() =>
  import('@/features/receipts/ReceiptDetailPage').then((m) => ({ default: m.ReceiptDetailPage })),
)
const BudgetPage = lazy(() =>
  import('@/features/budget/BudgetPage').then((m) => ({ default: m.BudgetPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

export function App() {
  const { loading, session, family, needsFamily } = useAuth()

  if (loading) return <FullPageSpinner label="טוען את MyShoppingList…" />

  // not signed in
  if (!session) {
    return (
      <Routes>
        <Route path="/join" element={<JoinPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    )
  }

  // signed in, but not attached to a family
  if (needsFamily || !family) {
    return (
      <Routes>
        <Route path="/join" element={<JoinPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    )
  }

  // fully onboarded
  return (
    <FamilyDataProvider familyId={family.id}>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/join" element={<Navigate to="/list" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/list" element={<ListPage />} />
            <Route path="/receipts" element={<ReceiptsPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          {/* full-screen (no bottom nav) */}
          <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
          <Route path="*" element={<Navigate to="/list" replace />} />
        </Routes>
      </Suspense>
    </FamilyDataProvider>
  )
}
