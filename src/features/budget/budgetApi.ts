import { supabase } from '@/lib/supabase'

/**
 * Upsert a budget cap. category_id === null is the overall monthly cap.
 * (Done app-side because Postgres UNIQUE treats NULLs as distinct, so a plain
 *  upsert on (family_id, category_id) can't target the overall row.)
 */
export async function setBudget(
  familyId: string,
  categoryId: string | null,
  amount: number,
): Promise<void> {
  let query = supabase.from('budgets').select('id').eq('family_id', familyId)
  query = categoryId === null ? query.is('category_id', null) : query.eq('category_id', categoryId)
  const { data: existing } = await query.maybeSingle()

  if (existing) {
    const { error } = await supabase.from('budgets').update({ amount }).eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('budgets')
      .insert({ family_id: familyId, category_id: categoryId, amount })
    if (error) throw error
  }
}

export async function clearBudget(familyId: string, categoryId: string | null): Promise<void> {
  let query = supabase.from('budgets').delete().eq('family_id', familyId)
  query = categoryId === null ? query.is('category_id', null) : query.eq('category_id', categoryId)
  const { error } = await query
  if (error) throw error
}
