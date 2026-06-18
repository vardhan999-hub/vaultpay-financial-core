import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invoiceId } = await req.json()

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID required' },
        { status: 400 }
      )
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('client_id', user.id)
      .single()

    if (error || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    if (invoice.status !== 'pending') {
      return NextResponse.json(
        { error: `Invoice cannot be paid — current status: ${invoice.status}` },
        { status: 400 }
      )
    }

    // reuse the session if it's still open instead of spamming new ones on repeat clicks
    if (invoice.active_stripe_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          invoice.active_stripe_session_id
        )

        if (existingSession.status === 'open' && existingSession.url) {
          return NextResponse.json({ url: existingSession.url })
        }
      } catch {
        // expired/missing on Stripe's end, just make a new one
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: invoice.invoice_number,
              description: invoice.description,
            },
            unit_amount: Math.round(invoice.amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId: invoice.id,
        clientId: user.id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/client/invoices?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/client/invoices`,
    })

    await supabase
      .from('invoices')
      .update({ active_stripe_session_id: session.id })
      .eq('id', invoiceId)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}