# Prompts.md — AI Assistance Log

**Project:** VaultPay Financial Core
**Author:** Harsha Vardhan Tadigadapa
**Internship Phase:** Client Delivery Phase III — Finance & Security

This document records exactly where and how I used AI assistance during this project, what I asked, what the AI explained, and what decision I made as a result. Written in the Q&A reasoning style established in prior weeks.

---

## Topic 1 — Stripe Webhook Signature Verification

**What I was trying to do:**
I needed to verify that incoming webhook POST requests to `/api/stripe-webhook` were actually from Stripe and not from a malicious third party spoofing the endpoint.

**What I asked the AI:**
> "How does Stripe webhook signature verification work? Why can't I just check the event type and process it?"

**What the AI explained:**
Stripe signs every webhook payload using your webhook secret and includes the signature in the `stripe-signature` header. The `stripe.webhooks.constructEvent()` method recomputes the expected signature from the raw request body and the secret, then compares it to the incoming header. If they don't match, it throws an error and you return a 400 to Stripe.

The important detail: you must pass the **raw** body string to `constructEvent`, not the parsed JSON. Next.js App Router parses the body automatically if you call `req.json()`, which destroys the original byte order and makes the signature check fail. So I had to use `req.text()` instead.

The AI also pointed out that the non-null assertion `const sig = req.headers.get('stripe-signature')!` would crash if Stripe's header was missing. The safer pattern is an explicit null check with an early 400 return.

**What I did:**
```ts
const body = await req.text()   // raw body required for signature check
const sig = req.headers.get('stripe-signature')

if (!sig) {
  return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
}

event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
```

**Why it matters for this project:**
Without signature verification, any attacker who knows my webhook URL could POST a fake `checkout.session.completed` event and mark any invoice as paid without payment ever occurring. This directly violates the Week 20 requirement: "if a payment is marked paid fraudulently, your project will be instantly rejected."

---

## Topic 2 — Server-Side PDF Generation with PDFKit

**What I was trying to do:**
The brief says "Download PDF button that fetches the generated PDF from the backend." I initially thought about using a client-side library like jsPDF, but that would generate the PDF in the browser.

**What I asked the AI:**
> "Why can't I generate the PDF on the client side? What is the correct pattern for server-side PDF generation in Next.js with PDFKit?"

**What the AI explained:**
Client-side PDF generation using jsPDF runs in the browser, which means:
1. The invoice data has to be sent to the browser first, so a malicious client could access another user's data before the PDF is even generated
2. It is trivially bypassable — anyone can call `jsPDF` themselves with fake data
3. The brief explicitly says "fetches the generated PDF from the backend"

PDFKit generates PDFs as a Node.js stream. In Next.js App Router, you collect the stream chunks into a `Buffer` array using the `data` event, then concatenate them on `end`. You return this buffer as a `NextResponse` with `Content-Type: application/pdf` and `Content-Disposition: attachment`.

The AI also pointed out that I should extract the PDF generation into a shared `generateInvoicePdfBuffer()` function used by both the `/api/generate-pdf` download route and the webhook email attachment. This way, the PDF a client downloads and the PDF emailed to them as a receipt are always identical — they cannot drift apart if I update the template.

**What I did:**

Created `lib/generate-invoice-pdf.ts` as a shared async function:
```ts
export async function generateInvoicePdfBuffer(invoice: Invoice): Promise<Buffer> {
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', resolve)
    doc.on('error', reject)
    // ... draw invoice ...
    doc.end()
  })
  return Buffer.concat(chunks)
}
```

Both `/api/generate-pdf` and `/api/stripe-webhook` import and call this same function.

**Why it matters:**
RLS at the database level prevents a client from fetching another user's invoice. The generate-pdf route relies entirely on Supabase returning nothing for an unauthorized invoice ID, so the PDF never reaches a client who shouldn't have it.

---

## Topic 3 — Atomic Payment Processing and Idempotency

**What I was trying to do:**
When the webhook fires, I needed to both update the invoice status to `paid` and insert a row into the `payments` table. I initially wrote this as two sequential Supabase calls in the webhook handler.

**What I asked the AI:**
> "What's the problem with doing the invoice update and payment insert as two separate API calls in my webhook handler? Stripe can retry webhooks."

**What the AI explained:**
Two sequential calls are not atomic. If the invoice update succeeds but the network drops before the payment insert runs, you end up with an invoice marked `paid` but no payment record. If Stripe then retries the webhook, your idempotency check looks at the `payments` table for an existing record — finds nothing — and tries to process the payment again. Now you have a duplicate processing scenario.

The correct pattern is a Postgres `SECURITY DEFINER` function that runs both operations inside a single transaction. Either both succeed or both are rolled back.

The AI also explained two additional guards to make this fully safe:

**Guard 1 — `AND status = 'pending'` on the UPDATE:**
If a webhook retry arrives after the invoice is already paid, the UPDATE affects zero rows. Without this guard, `stripe_session_id` and `paid_at` would be silently overwritten even though no state transition occurred.

**Guard 2 — `IF FOUND THEN` before the INSERT:**
After the UPDATE, `FOUND` is true only if at least one row was actually changed. The payment INSERT is wrapped in `IF FOUND THEN ... END IF`, so a payment record is only ever created when the invoice actually transitioned from pending to paid in that same call. This closes the race condition where two concurrent retries both pass the `payments` table idempotency check before either has inserted a row.

**Guard 3 — `ON CONFLICT (stripe_session_id) DO NOTHING`:**
Belt-and-suspenders. Even if two concurrent calls somehow both reach the INSERT, the unique constraint on `payments.stripe_session_id` ensures only one succeeds.

**What I did:**
```sql
CREATE OR REPLACE FUNCTION process_successful_payment(
  p_invoice_id uuid,
  p_session_id text,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE invoices
  SET status = 'paid', paid_at = now(), stripe_session_id = p_session_id,
      active_stripe_session_id = NULL
  WHERE id = p_invoice_id AND status = 'pending';

  v_updated := FOUND;

  IF v_updated THEN
    INSERT INTO payments(invoice_id, stripe_session_id, amount, status)
    VALUES(p_invoice_id, p_session_id, p_amount, 'completed')
    ON CONFLICT (stripe_session_id) DO NOTHING;
  END IF;
END;
$$;
```

---

## Topic 4 — Preventing Duplicate Stripe Checkout Sessions

**What I was trying to do:**
A client could click "Pay Now", get redirected to Stripe, close the browser tab, and click "Pay Now" again. Each click was creating a new Stripe Checkout session. Stripe allows this and it doesn't cause double-charging (the webhook idempotency handles that), but it clutters the Stripe dashboard and is not production-quality behavior.

**What I asked the AI:**
> "How do I prevent a new Stripe Checkout session from being created every time the user clicks Pay on the same invoice?"

**What the AI explained:**
The standard pattern is to store the most recent session ID on the invoice row (`active_stripe_session_id`) and check whether it is still open before creating a new one. Stripe sessions expire after 24 hours, so you cannot blindly reuse an old ID — you must call `stripe.checkout.sessions.retrieve()` and verify `status === 'open'` before returning the existing URL.

If the session is expired or the Stripe API throws (session ID not found), you fall through and create a new session, then store its ID.

**What I did:**
```ts
if (invoice.active_stripe_session_id) {
  try {
    const existingSession = await stripe.checkout.sessions.retrieve(
      invoice.active_stripe_session_id
    )
    if (existingSession.status === 'open' && existingSession.url) {
      return NextResponse.json({ url: existingSession.url })
    }
  } catch {
    // session expired or not found on Stripe — create a new one below
  }
}

const session = await stripe.checkout.sessions.create({ ... })

await supabase
  .from('invoices')
  .update({ active_stripe_session_id: session.id })
  .eq('id', invoiceId)
```

The webhook clears `active_stripe_session_id` to `NULL` when it marks the invoice as paid, so a paid invoice can never accidentally reuse an old session.

---

## Topic 5 — Row Level Security Policy Design

**What I was trying to do:**
I needed clients to be completely isolated from each other's data at the database level, not just at the application level. If a client guesses another client's invoice UUID and hits the API directly, they should get nothing.

**What I asked the AI:**
> "How do I design Supabase RLS policies so that a client user can never read another client's invoices, even if they know the exact UUID?"

**What the AI explained:**
RLS policies are evaluated at the database query level, before the result is returned to the application. A SELECT policy with `USING (auth.uid() = client_id)` means Postgres physically filters out any row where the authenticated user's ID doesn't match `client_id`. Even a direct API call to Supabase with a valid JWT for client A cannot return client B's rows — the database rejects them before they travel over the network.

The AI also flagged a critical issue with the profiles UPDATE policy: a naive `WITH CHECK (auth.uid() = id)` would allow a client to run `UPDATE profiles SET role='admin' WHERE id=auth.uid()` and promote themselves. The correct approach is to have no UPDATE policy at all on the profiles table, and instead expose a `SECURITY DEFINER` RPC that whitelists only the specific columns a client is allowed to change (`full_name`, `company`) and explicitly excludes `role`.

**What I did:**
- No UPDATE policy on `profiles`
- Created `update_profile(p_name, p_company)` RPC with `SECURITY DEFINER` and `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated`
- `REVOKE INSERT ON profiles FROM authenticated` — profiles are only ever created by the `handle_new_user()` trigger
- Client invoice policy: `USING (auth.uid() = client_id)` — one line that makes cross-client data leaks impossible at the database level

---

## Topic 6 — Email Receipt with PDF Attachment via Resend

**What I was trying to do:**
After a successful payment, the client should automatically receive a PDF receipt by email. I needed to attach the same PDF buffer used for the download endpoint to an outbound email.

**What I asked the AI:**
> "How do I send an email with a PDF Buffer as an attachment in Node.js? I'm using Resend."

**What the AI explained:**
Resend's `emails.send()` accepts an `attachments` array where each item has a `filename` string and a `content` field that accepts a Node.js `Buffer` directly. This means I can pass the output of `generateInvoicePdfBuffer()` straight to the attachment without any base64 encoding step.

The AI advised wrapping the entire PDF generation and email send in a try-catch inside the webhook, with a critical note: email failure must never cause the webhook to return a non-200 status to Stripe. If it did, Stripe would retry the webhook indefinitely, potentially re-processing the payment. The payment is already committed to the database at this point — email is a best-effort secondary action.

**What I did:**
```ts
try {
  const pdfBuffer = await generateInvoicePdfBuffer(invoice)
  const emailResult = await sendInvoiceReceiptEmail({
    to: invoice.client_email,
    clientName: invoice.client_name,
    invoiceNumber: invoice.invoice_number,
    amount: invoice.amount,
    pdfBuffer,
  })
  if (emailResult.success) {
    console.log(`[Webhook] Receipt email sent successfully to ${invoice.client_email}`)
  }
} catch (pdfErr) {
  // PDF/email failure never fails the webhook response
  console.error('[Webhook] PDF generation or email send failed:', pdfErr)
}

return NextResponse.json({ received: true })  // always 200 to Stripe
```

---

## Summary

| Topic | AI helped me understand | Decision I made |
|-------|------------------------|-----------------|
| Webhook signature | Raw body required; explicit null check on header | Used `req.text()` + null guard |
| Server PDF | Client-side PDF violates the requirement; shared buffer function prevents drift | Extracted `generateInvoicePdfBuffer()` shared lib |
| Atomic payment | Two sequential calls are not atomic under retries | SECURITY DEFINER RPC with FOUND guard + ON CONFLICT |
| Duplicate sessions | Store and reuse active session ID; verify it is still open | `active_stripe_session_id` column + Stripe retrieve check |
| RLS design | No UPDATE policy prevents role escalation | RPC for safe field updates; REVOKE INSERT on profiles |
| Email attachment | Buffer passes directly to Resend; email must never fail the webhook | try-catch wrapping; always return 200 |

