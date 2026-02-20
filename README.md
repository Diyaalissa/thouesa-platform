# THOUESA × THOUESA — Jordan ⇄ Algeria Logistics Platform

Companies:
- **THOUESA (تحويسة)** — Jordan operations
- **THOUESA (تحويسة)** — Algeria operations

This monorepo contains:
- `apps/web`: Next.js customer + admin UI
- `apps/api`: Node.js (Express) API + Prisma + PostgreSQL
- `docs/legal`: Terms, policies, and legal undertaking (Arabic)

## Features (MVP)
- Auth: register/login (JWT)
- Customer dashboard: create shipment / assisted purchase request
- Pricing: weight-based estimate + final price set by admin
- Payments: manual receipt upload + admin confirmation
- Order status lifecycle

## Tech
- Web: Next.js (App Router) + TypeScript + Tailwind
- API: Express + TypeScript + Prisma
- DB: PostgreSQL (Docker Compose)

## Quick start

### 1) Prereqs
- Node.js 18+ (or 20+)
- npm 9+ (or pnpm/yarn)
- Docker Desktop / Docker Engine

### 2) Configure env
Copy env examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 3) Start database
```bash
docker compose up -d db
```

### 4) Install deps (root)
```bash
npm install
```

### 5) Prisma migrate + seed
```bash
npm run db:migrate
npm run db:seed
```

### 6) Run dev
```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000

## Admin
Seed creates an admin user:
- email: `admin@thouesa.test`
- password: `Admin12345!`

## Legal
Arabic legal pages are in `docs/legal` and mirrored in web routes under `/legal/*`.

## License
Proprietary — internal use.

## تشغيل المشروع على Windows 11 (مختصر)

### المتطلبات
- Node.js (مثبت عندك ✅)
- pnpm: `npm i -g pnpm`
- PostgreSQL (بدون Docker) أو Docker Desktop (اختياري)

### التثبيت
من مجلد المشروع:
```bash
pnpm install
```

### إعداد قاعدة البيانات (PostgreSQL على Windows)
1) أنشئ قاعدة بيانات باسم `thouesa`.
2) انسخ `apps/api/.env.example` إلى `apps/api/.env` وعدّل كلمة المرور.

ثم:
```bash
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed
```

### التشغيل
```bash
pnpm run dev
```
- Web: http://localhost:3000
- API: http://localhost:4000

### بوابة الإدارة (موقع منفصل)
تشغيل واجهة الإدارة على منفذ 3001:
```bash
pnpm run dev:admin
```
ثم افتح:
- Admin: http://localhost:3001


### التسجيل
أثناء إنشاء الحساب، يطلب النظام اختيار الدولة (الأردن/الجزائر) وإدخال رقم الهاتف للعميل.

## إرسال رمز OTP عبر البريد (SMTP)

الافتراضي في وضع التطوير: يتم طباعة الرمز في Console الخاص بسيرفر الـ API.

لإرسال الرمز فعلياً عبر البريد:
1) افتح `apps/api/.env` وأضف إعدادات SMTP (انظر `.env.example`).
2) Gmail: فعّل التحقق بخطوتين للحساب ثم أنشئ App Password واستخدمه كـ `SMTP_PASS`.
3) أعد تشغيل السيرفر.

> ملاحظة: لا تضع كلمات المرور داخل GitHub. استخدم متغيرات البيئة فقط.

## إضافات جديدة (v11)
- إعدادات قابلة للتعديل من لوحة الإدارة (أسعار الشحن/العمولة/روابط التواصل/العروض/USDT الداخلي).
- تتبع الطلب برقم الطلب: `/track` (يعرض الحالة فقط).
- سجل تغيّر حالة الطلب (Audit Log) داخل قاعدة البيانات.
- دعم رفع أكثر من إيصال (يتم حفظ كل إيصال في PaymentReceipt) مع إبقاء `receiptUrl` كآخر إيصال للتوافق.


## v12
- إضافة عرض سجل تغيّر حالة الطلب داخل بوابة الإدارة (مع زر "سجل الحالة" لكل طلب).


## v13
- إضافة فلترة سجل الحالة حسب Status داخل لوحة الإدارة.
- إضافة تصدير سجل الحالة إلى CSV لكل طلب.

## تشغيل Production عبر Docker (اختياري)
1) ضع متغيرات البيئة في ملف `.env` بجانب `docker-compose.prod.yml` (مثل POSTGRES_PASSWORD و JWT_SECRET و SMTP_*).
2) شغّل:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
- Web: http://localhost:3000
- Admin: http://localhost:3001
- API: http://localhost:4000
