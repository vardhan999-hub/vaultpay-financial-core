# VaultPay Financial Core

A secure, role-based B2B invoicing and payment portal built for Nexus Corporate Services. Administrators create invoices for clients. Clients log in, view only their own invoices, pay via Stripe Checkout, and automatically receive a PDF receipt by email.

**Live Demo:** https://vaultpay-financial-core-delta.vercel.app/login

---

## Test Credentials

| Role    | Email                  | Password   |
|---------|------------------------|------------|
| Admin   | admin@vaultpay.com     | Admin@123  |
| Client  | client@nexus.com       | Client@123 |
| Client  | client2@nexus.com      | client@123 |

**Stripe Test Card:** `4242 4242 4242 4242` — any future expiry, any CVC, any ZIP

---

## Tech Stack

| Layer     | Technology                           |
|-----------|--------------------------------------|
| Framework | Next.js 14 (App Router, TypeScript)  |
| Styling   | Tailwind CSS                         |
| Auth + DB | Supabase (Auth, PostgreSQL, RLS)     |
| Payments  | Stripe Checkout + Webhooks           |
| PDF       | PDFKit (server-side generation)      |
| Email     | Resend                               |
| Toasts    | Sonner                               |
| Icons     | Lucide React                         |
| Deploy    | Vercel                               |

---

## Features

### Admin
- Secure login with role-based redirect
- Dashboard showing total invoices, revenue, pending count, client count
- Create invoices via modal — client name and email fetched server-side from the database, never trusted from the browser
- Mark overdue invoices in one click
- View all invoices with live status badges

### Client
- Sees only their own invoices (enforced by Supabase RLS at the database level)
- Invoice list with status, amount, due date
- Click any row to open the Invoice Detail page
- Pay pending invoices via Stripe Checkout — Pay button disabled immediately on click, no double-charge possible
- Download PDF directly from the backend (not client-generated)
- Receives a PDF receipt by email automatically after payment (Sandbox mode for testing)
- Attempting to access `/admin/dashboard` results in an immediate 403 redirect

---

## Security Architecture

Three independent layers protect every resource.

**Layer 1 — Next.js Middleware**
Unauthenticated users are redirected to `/login` before any page loads. Any authenticated user without the admin role who tries to visit `/admin/*` is immediately redirected to `/403`.

**Layer 2 — Server Component Role Checks**
Every protected page re-verifies the user's role server-side via `createClient()` before rendering, even if middleware were somehow bypassed.

**Layer 3 — Supabase Row Level Security**
- `profiles`: users can only read their own row. No UPDATE policy exists — role escalation (`SET role='admin'`) is impossible from the client side. Role changes go through a SECURITY DEFINER RPC that restricts which columns can change.
- `invoices`: clients see only rows where `client_id = auth.uid()`. Admin sees all.
- `payments`: clients can only see payment records tied to their own invoices.

**API Route Protection**
- `POST /api/invoices` — verifies admin role before any insert
- `POST /api/create-checkout-session` — verifies invoice ownership; only `pending` invoices can be checked out
- `GET /api/generate-pdf` — RLS ensures requesting another user's invoice ID returns 404
- `POST /api/stripe-webhook` — validates Stripe signature; uses an atomic RPC so invoice update and payment record are written together or not at all

---

## Database Schema

```
profiles
  id uuid PK, email, full_name, role CHECK(admin|client), company, created_at

invoices
  id uuid PK, invoice_number UNIQUE, client_id FK, client_name, client_email,
  description, amount CHECK(>0), status CHECK(pending|paid|overdue),
  due_date, paid_at, active_stripe_session_id, stripe_session_id, created_at, updated_at

payments
  id uuid PK, invoice_id FK, stripe_session_id UNIQUE, amount CHECK(>0),
  status CHECK(completed|failed|refunded), created_at
```

Profiles are auto-created via a `handle_new_user()` trigger on `auth.users` — no manual UUID management. New users default to `client`. Admins are promoted with a single SQL UPDATE.

---

## How Payments Work

1. Client clicks **Pay Invoice**
2. Server checks for an existing open Stripe session on the invoice and reuses it if valid; otherwise creates a new one and stores the session ID on the invoice row
3. Client is redirected to Stripe hosted checkout
4. On success, Stripe fires `checkout.session.completed` to `/api/stripe-webhook`
5. Webhook verifies the signature and confirms `payment_status === 'paid'`
6. Calls `process_successful_payment()` RPC which atomically updates the invoice to `paid` and inserts a payment record — guarded by `AND status = 'pending'` and `ON CONFLICT DO NOTHING` to make it fully idempotent under concurrent webhook retries
7. Webhook generates a PDF via shared `generateInvoicePdfBuffer()` and sends it as an email attachment via Resend

---

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/vardhan999-hub/vaultpay-financial-core.git
cd vaultpay-financial-core
npm install
```

### 2. Environment variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database setup

Run the complete SQL script in the Supabase SQL Editor.

### 4. Create auth users

Go to **Supabase → Authentication → Add User**. Create:
- `admin@vaultpay.com` / `Admin@123`
- `client@nexus.com` / `Client@123`

The trigger auto-creates both profiles as `client`. Promote the admin:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@vaultpay.com';
```

### 5. Run dev server

```bash
npm run dev
```

### 6. Forward webhooks locally

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Copy the webhook signing secret from the CLI output into `STRIPE_WEBHOOK_SECRET`.

---

## Deployment (Vercel)

1. Push repo to GitHub (public)
2. Import into Vercel, add all environment variables
3. Set `NEXT_PUBLIC_APP_URL` to your Vercel URL
4. Stripe Dashboard → Developers → Webhooks → Add Endpoint → `https://your-vercel-url/api/stripe-webhook`
5. Select event: `checkout.session.completed`
6. Copy signing secret into Vercel as `STRIPE_WEBHOOK_SECRET` and redeploy

---

## Project Structure

```
vaultpay-financial-core/
├── middleware.ts                    # Route guard — RBAC at edge
├── types/index.ts                   # Shared TypeScript interfaces
├── lib/
│   ├── supabase/client.ts           # Browser Supabase client
│   ├── supabase/server.ts           # Server Supabase client (SSR)
│   ├── stripe.ts                    # Stripe singleton
│   ├── email.ts                     # Resend email helper
│   └── generate-invoice-pdf.ts      # Shared PDFKit buffer generator
└── app/
    ├── login/page.tsx               # Login page
    ├── 403/page.tsx                 # Unauthorized page
    ├── api/invoices/route.ts        # Create invoice (admin only)
    ├── api/create-checkout-session/ # Start Stripe Checkout
    ├── api/stripe-webhook/          # Handle payment confirmation
    ├── api/generate-pdf/            # Serve PDF download
    ├── admin/dashboard/             # Admin dashboard + create modal
    └── client/invoices/             # Client invoice list + detail page
```

---

## Author

**Tadigadapa Harsha Vardhan**
Frontend Development Intern — Prodesk IT
GitHub: [vardhan999-hub](https://github.com/vardhan999-hub)
LinkedIn: [harshatadigadapa](https://linkedin.com/in/harshatadigadapa)
