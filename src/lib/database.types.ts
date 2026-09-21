// Hand-written types mirroring supabase/migrations/0001_init.sql.
// If you later run `supabase gen types typescript`, you can replace this file.

export type Unit = 'unit' | 'kg' | 'liter'
export type ListItemStatus = 'active' | 'bought'
export type ItemType = 'product' | 'deposit' | 'other'
export type ReceiptStatus = 'processing' | 'parsed' | 'confirmed' | 'failed'
export type Confidence = 'high' | 'low'

export interface Family {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  family_id: string | null
  display_name: string | null
  created_at: string
}

export interface FamilyInvite {
  id: string
  family_id: string
  token: string
  created_by: string | null
  created_at: string
  expires_at: string | null
  used_at: string | null
}

export interface Category {
  id: string
  family_id: string
  name: string
  created_at: string
}

export interface Product {
  id: string
  family_id: string
  name: string
  barcode: string | null
  category_id: string | null
  default_unit: Unit
  created_at: string
}

export interface ShoppingListItem {
  id: string
  family_id: string
  product_id: string | null
  raw_text: string | null
  category_id: string | null
  quantity: number
  unit: Unit
  status: ListItemStatus
  added_by: string | null
  bought_at: string | null
  bought_price: number | null
  bought_store: string | null
  bought_source: 'manual' | 'receipt' | null
  created_at: string
}

export interface Receipt {
  id: string
  family_id: string
  uploaded_by: string | null
  store_name: string | null
  store_branch: string | null
  purchase_date: string | null
  purchase_time: string | null
  receipt_number: string | null
  currency: string
  subtotal: number | null
  total: number | null
  status: ReceiptStatus
  raw_model_json: unknown | null
  image_paths: string[] | null
  error: string | null
  parsed_at: string | null
  confirmed_at: string | null
  created_at: string
}

export interface ReceiptItem {
  id: string
  receipt_id: string
  family_id: string
  raw_name: string
  barcode: string | null
  item_type: ItemType
  quantity: number
  unit: Unit
  full_unit_price: number | null
  line_total: number | null
  discount: number
  real_unit_price: number | null
  matched_product_id: string | null
  confidence: Confidence | null
  created_at: string
}

export interface PriceHistory {
  id: string
  family_id: string
  product_id: string
  receipt_item_id: string | null
  real_unit_price: number
  full_unit_price: number | null
  unit: Unit
  store_name: string | null
  purchase_date: string
  created_at: string
}

export interface Budget {
  id: string
  family_id: string
  category_id: string | null
  amount: number
  created_at: string
}

// Insert helpers (columns with DB defaults are optional)
export type Insert<T, Optional extends keyof T> = Omit<T, Optional | 'id' | 'created_at'> &
  Partial<Pick<T, Optional>>
