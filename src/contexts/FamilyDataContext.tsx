import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import type { Category, Product, Profile } from '@/lib/database.types'

interface FamilyDataValue {
  familyId: string
  categories: Category[]
  products: Product[]
  members: Profile[]
  loading: boolean
  categoryName: (id: string | null | undefined) => string
  memberName: (id: string | null | undefined) => string
  addCategory: (name: string) => Promise<Category>
  deleteCategory: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const FamilyDataContext = createContext<FamilyDataValue | undefined>(undefined)

export function FamilyDataProvider({
  familyId,
  children,
}: {
  familyId: string
  children: ReactNode
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [{ data: cats }, { data: prods }, { data: profs }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('profiles').select('*'),
    ])
    setCategories((cats ?? []) as Category[])
    setProducts((prods ?? []) as Product[])
    setMembers((profs ?? []) as Profile[])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const channel = supabase
      .channel(`family-data-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `family_id=eq.${familyId}` },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `family_id=eq.${familyId}` },
        () => refresh(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [familyId, refresh])

  const categoryName = useCallback(
    (id: string | null | undefined) => categories.find((c) => c.id === id)?.name ?? '',
    [categories],
  )

  const memberName = useCallback(
    (id: string | null | undefined) =>
      members.find((m) => m.id === id)?.display_name ?? '',
    [members],
  )

  const addCategory = useCallback(
    async (name: string): Promise<Category> => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ family_id: familyId, name: name.trim() })
        .select()
        .single()
      if (error) throw error
      await refresh()
      return data as Category
    },
    [familyId, refresh],
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<FamilyDataValue>(
    () => ({
      familyId,
      categories,
      products,
      members,
      loading,
      categoryName,
      memberName,
      addCategory,
      deleteCategory,
      refresh,
    }),
    [
      familyId,
      categories,
      products,
      members,
      loading,
      categoryName,
      memberName,
      addCategory,
      deleteCategory,
      refresh,
    ],
  )

  return <FamilyDataContext.Provider value={value}>{children}</FamilyDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFamilyData(): FamilyDataValue {
  const ctx = useContext(FamilyDataContext)
  if (!ctx) throw new Error('useFamilyData must be used inside <FamilyDataProvider>')
  return ctx
}
