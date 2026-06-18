import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

import { stripe } from '@/lib/stripe'
import { generateInvoicePdfBuffer } from '@/lib/generate-invoice-pdf'
import { sendInvoiceReceiptEmail } from '@/lib/email'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

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
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error('Webhook signature verification failed:', error)

    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    )
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  const invoiceId = session.metadata?.invoiceId

  if (!invoiceId) {
    console.error('invoiceId missing in session metadata')

    return NextResponse.json(
      { error: 'invoiceId missing' },
      { status: 400 }
    )
  }

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true })
  }

  const {
    data: existingPayment,
  } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle()

  if (existingPayment) {
    return NextResponse.json({ received: true })
  }

  const amount = (session.amount_total ?? 0) / 100

  const {
    error: invoiceError,
  } = await supabaseAdmin
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      active_stripe_session_id: null,
    })
    .eq('id', invoiceId)

  if (invoiceError) {
    console.error(
      'Failed to update invoice:',
      invoiceError
    )

    return NextResponse.json(
      { error: 'Invoice update failed' },
      { status: 500 }
    )
  }

  const {
    error: paymentError,
  } = await supabaseAdmin
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      stripe_session_id: session.id,
      amount,
      status: 'completed',
    })

  if (paymentError) {
    console.error(
      'Failed to save payment:',
      paymentError
    )
  }

  const {
    data: invoice,
    error: fetchError,
  } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (fetchError) {
    console.error(
      'Failed to fetch invoice:',
      fetchError
    )
  }

  if (invoice) {
    try {
      const pdfBuffer =
        await generateInvoicePdfBuffer(invoice)

      const emailResult =
        await sendInvoiceReceiptEmail({
          to: invoice.client_email,
          clientName: invoice.client_name,
          invoiceNumber:
            invoice.invoice_number,
          amount: invoice.amount,
          pdfBuffer,
        })

      if (!emailResult.success) {
        console.error(
          'Receipt email failed:',
          emailResult.error
        )
      }
    } catch (error) {
      console.error(
        'Receipt generation failed:',
        error
      )
    }
  }

  return NextResponse.json({
    received: true,
  })
}
