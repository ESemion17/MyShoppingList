# MyShoppingList 🛒

אפליקציית ניהול קניות והוצאות משפחתית — **PWA** בעברית (RTL), mobile-first.
רשימת קניות משותפת בזמן אמת · קריאת קבלות אוטומטית עם מודל ראייה · מעקב מחירים ותקציב חודשי.

בנוי לפי `spec.md` (אפיון) ו-`implementation-guide.md` (מדריך מימוש). **עלות: אפס** — הכול על מסלולים חינמיים.

---

## מחסן טכנולוגי

| שכבה | טכנולוגיה |
|---|---|
| לקוח | React + Vite + TypeScript, PWA (`vite-plugin-pwa`), Tailwind CSS (RTL) |
| שרת | Supabase — Postgres, Auth, Realtime, Storage, Edge Function אחת |
| היסק | NVIDIA NIM — Nemotron Nano 2 VL (דרך ממשק תואם-OpenAI) |
| אירוח | Vercel (לקוח) + Supabase (שרת) |

---

## מבנה הפרויקט

```
src/
├─ lib/            # לקוח Supabase, טיפוסים, פורמט, התאמה מטושטשת
├─ contexts/       # AuthContext (התחברות+משפחה), FamilyDataContext (קטגוריות/מוצרים/חברים)
├─ components/     # רכיבי UI משותפים
└─ features/
   ├─ auth/        # שלב 0 — התחברות, יצירת/הצטרפות למשפחה, קישורי הזמנה
   ├─ list/        # שלב 0 — רשימת קניות בזמן אמת
   ├─ receipts/    # שלב 1 — העלאה, קריאה, מסך אישור, התאמה
   ├─ budget/      # שלב 2 — מחירים, פילוח, תקציב והתראות
   └─ settings/    # משפחה, הזמנות, קטגוריות
supabase/
├─ migrations/     # 0001 סכמה · 0002 RLS+Storage+Realtime · 0003 טריגרים+RPC
└─ functions/parse-receipt/   # index.ts (תזמור) · llm.ts (ספק) · schema.ts (Zod)
```

---

## הקמה מקומית — צעד אחר צעד

### 1. דרישות מקדימות
- Node.js 18+ · חשבון [Supabase](https://supabase.com) · מפתח API מ-[build.nvidia.com](https://build.nvidia.com) (מתחיל ב-`nvapi-`) · [Supabase CLI](https://supabase.com/docs/guides/cli).

### 2. תלויות
```bash
npm install
```

### 3. פרויקט Supabase
1. צור פרויקט חדש ב-Supabase.
2. **Auth** → הפעל ספק **Email**. לפיתוח מהיר אפשר לכבות אישור מייל (Auth → Providers → Email → *Confirm email* = off).
3. קבל את המפתחות ב-**Project Settings → API**: `Project URL` ו-`anon public`.

### 4. משתני סביבה (לקוח)
```bash
cp .env.local.example .env.local
```
מלא ב-`.env.local`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```
> ⚠️ רק מפתחות `VITE_*` כאן. מפתח NVIDIA ומפתח ה-service_role **לעולם לא** בלקוח.

### 5. סכמה + RLS + Storage (מיגרציות)
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```
זה מריץ את שלוש המיגרציות: הסכמה, מדיניות ה-RLS (כולל דלי Storage בשם `receipts` ומדיניותו), הטריגרים וה-RPC. **Realtime** מופעל אוטומטית על `shopping_list_items`, `receipts`, `categories`, `products`.

### 6. פונקציית קריאת הקבלה
```bash
# הסוד — חי רק בצד השרת:
supabase secrets set NVIDIA_API_KEY=nvapi-xxxxxxxx

# פריסה:
supabase functions deploy parse-receipt
```
> `SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` מוזרקים אוטומטית לפונקציה — אין צורך להגדירם.

> **⚠️ לאמת מול build.nvidia.com** (`supabase/functions/parse-receipt/llm.ts`):
> - `MODEL` — מחרוזת המודל המדויקת (`nvidia/nemotron-nano-2-vl` או המעודכנת בעמוד המודל).
> - פורמט התמונה — חלק ממודלי NIM מצפים לתמונה מוטמעת בטקסט או דרך Assets API לגדלים גדולים.
> החלפת ספק = שינוי שלושת הקבועים בראש `llm.ts` בלבד.

### 7. הרצה
```bash
npm run dev
```
פותח על `http://localhost:5173`. הירשם, צור משפחה, והתחל.

---

## פריסה

### לקוח → Vercel
1. דחוף ל-git וחבר את ה-repo ל-Vercel (מזהה Vite אוטומטית: build `vite build`, output `dist`).
2. הגדר ב-Vercel רק: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. הוסף את דומיין ה-Vercel ל-Supabase → Auth → **URL Configuration** (Site URL + Redirect URLs), אחרת קישורי ההזמנה/התחברות לא יפנו נכון.

### שרת → Supabase
כבר נפרס בצעדים 5–6. עדכונים עתידיים: `supabase db push` (מיגרציות) ו-`supabase functions deploy parse-receipt`.

---

## אבטחת מפתחות

| מפתח | היכן | חשוף ללקוח? |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` / Vercel | כן — ציבורי |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` / Vercel | כן — מוגן ב-RLS |
| `NVIDIA_API_KEY` | סוד Edge Function בלבד | **לעולם לא** |
| `SUPABASE_SERVICE_ROLE_KEY` | אוטומטי בתוך הפונקציה | **לעולם לא** |

---

## איך זה עובד — נקודות מפתח

- **בידוד משפחות (RLS):** כל טבלה נושאת `family_id`; מדיניות `family_rw` מתירה גישה רק לחברי המשפחה. הפונקציה רצה עם service role ומאמתת חברוּת ידנית לפני כתיבה.
- **המודל קורא, המערכת מחשבת:** `parse-receipt` מחלץ רק מה שמודפס. המחיר האמיתי ליחידה = `line_total ÷ quantity` (מטפל אוטומטית ב"3 ב-2"). מחושב בקוד, לא במודל.
- **צעד האישור** (`ReceiptDetailPage`): המשתמש מתקן שדות, פותר עמימות בהתאמת מוצרים (ברקוד → מטושטש → מוצר חדש). באישור: כתיבת `price_history`, סימון אוטומטי של פריטים תואמים ברשימה כ"נקנו", ומחיקת התמונות מ-Storage.
- **מקורות ההוצאה:** קבלות מאושרות + פריטים שסומנו ידנית עם מחיר. `bought_source` מבדיל ביניהם כדי למנוע ספירה כפולה בתקציב.

---

## סקריפטים

| פקודה | פעולה |
|---|---|
| `npm run dev` | שרת פיתוח |
| `npm run build` | בנייה לפרודקשן (`dist/`) |
| `npm run preview` | תצוגה מקדימה של הבנייה |
| `npm run typecheck` | בדיקת טיפוסים |

---

## רשימת תיוג (מהמדריך §10)

- [x] פרויקט Vite/React/PWA + Tailwind (RTL)
- [x] סכמת DDL + RLS על כל הטבלאות המשפחתיות
- [x] Auth (אימייל+סיסמה), Realtime, דלי Storage `receipts` + מדיניות
- [x] מפתח NVIDIA כסוד של הפונקציה (לא בלקוח)
- [x] **שלב 0:** התחברות, משפחה, קישור הזמנה, רשימה בזמן אמת
- [x] פונקציית `parse-receipt` (index/llm/schema) — ⚠️ לאמת מחרוזת מודל ופורמט תמונה
- [x] **שלב 1:** העלאה → קריאה → מסך אישור → התאמה, מחירים, מחיקת תמונות
- [x] **שלב 2:** היסטוריית מחירים, עלות סל חודשית, תקציב דו-רמתי והתראות
- [ ] פריסה ל-Vercel + פריסת הפונקציה (עם המפתחות שלך)
- [ ] אימות מחרוזת המודל ופורמט התמונה מול build.nvidia.com
