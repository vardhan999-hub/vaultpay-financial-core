import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { generateInvoicePdfBuffer } from '@/lib/generate-invoice-pdf'
import { sendInvoiceReceiptEmail } from '@/lib/email'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()

  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error(
      '[Webhook] Signature verification failed:',
      err
    )

    return NextResponse.json(
      { error: 'Webhook signature failed' },
      { status: 400 }
    )
  }

  console.log('\n==============================')
  console.log('[Webhook] Event:', event.type)
  console.log('==============================\n')

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session =
    event.data.object as Stripe.Checkout.Session

  const invoiceId = session.metadata?.invoiceId

  console.log(
    `[Webhook] checkout.session.completed`
  )

  console.log('SESSION ID:', session.id)
  console.log('PAYMENT STATUS:', session.payment_status)
  console.log('METADATA:', session.metadata)
  console.log('INVOICE ID:', invoiceId)

  if (!invoiceId) {
    console.error(
      '[Webhook] invoiceId missing from metadata'
    )

    return NextResponse.json(
      { error: 'invoiceId missing' },
      { status: 400 }
    )
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true })
  }

  // Prevent duplicate webhook processing
  const { data: existingPayment } =
    await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle()

  if (existingPayment) {
    console.log(
      '[Webhook] Payment already processed'
    )

    return NextResponse.json({ received: true })
  }

  const amount =
    (session.amount_total ?? 0) / 100

  // Update invoice
  const { error: invoiceError } =
    await supabaseAdmin
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        active_stripe_session_id: null,
      })
      .eq('id', invoiceId)

  if (invoiceError) {
    console.error(
      '[Webhook] Invoice update failed:',
      invoiceError
    )

    return NextResponse.json(
      { error: 'Invoice update failed' },
      { status: 500 }
    )
  }

  console.log(
    '[Webhook] Invoice marked as paid'
  )

  // Insert payment row
  const { error: paymentError } =
    await supabaseAdmin
      .from('payments')
      .insert({
        invoice_id: invoiceId,
        stripe_session_id: session.id,
        amount,
        status: 'completed',
      })

  if (paymentError) {
    console.error(
      '[Webhook] Payment insert failed:',
      paymentError
    )
  } else {
    console.log(
      '[Webhook] Payment saved'
    )
  }

  // Fetch invoice
  const { data: invoice } =
    await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

  if (invoice) {
    try {
      console.log(
        '[Webhook] About to generate PDF'
      )

      const pdfBuffer =
        await generateInvoicePdfBuffer(invoice)

      console.log(
        '[Webhook] PDF generated:',
        pdfBuffer.length,
        'bytes'
      )

      console.log(
        '[Webhook] About to send email to:',
        invoice.client_email
      )

      console.log(
        '[Webhook] RESEND_API_KEY exists:',
        !!process.env.RESEND_API_KEY
      )

      const result =
        await sendInvoiceReceiptEmail({
          to: invoice.client_email,
          clientName: invoice.client_name,
          invoiceNumber:
            invoice.invoice_number,
          amount: invoice.amount,
          pdfBuffer,
        })

      console.log(
        '[Webhook] Email result:',
        result
      )

      if (result.success) {
        console.log(
          '[Webhook] Email sent successfully'
        )
      } else {
        console.error(
          '[Webhook] Email failed:',
          result.error
        )
      }
    } catch (err) {
      console.error(
        '[Webhook] PDF generation or email failed:',
        err
      )
    }
  }

  return NextResponse.json({
    received: true,
  })
}
