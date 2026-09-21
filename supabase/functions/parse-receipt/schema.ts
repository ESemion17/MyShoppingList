import { z } from 'https://esm.sh/zod@3.23.8'

export const Unit = z.enum(['unit', 'kg', 'liter'])

export const ReceiptItem = z.object({
  raw_name: z.string(),
  barcode: z.string().nullable(),
  item_type: z.enum(['product', 'deposit', 'other']).default('product'),
  quantity: z.number(),
  unit: Unit,
  unit_price: z.number().nullable(),
  line_total: z.number().nullable(),
  discount: z.number().default(0),
  confidence: z.enum(['high', 'low']),
})

export const ReceiptParse = z.object({
  store: z.object({
    name: z.string().nullable(),
    branch: z.string().nullable(),
    address: z.string().nullable(),
  }),
  purchase: z.object({
    date: z.string().nullable(),
    time: z.string().nullable(),
    receipt_number: z.string().nullable(),
    currency: z.string().default('ILS'),
  }),
  items: z.array(ReceiptItem),
  totals: z.object({
    subtotal: z.number().nullable(),
    total: z.number().nullable(),
  }),
  warnings: z.array(z.string()).default([]),
})

export type ReceiptParse = z.infer<typeof ReceiptParse>
