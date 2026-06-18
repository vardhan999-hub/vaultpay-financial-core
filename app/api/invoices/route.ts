import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { clientId, description, amount, dueDate } = await req.json()

    if (!clientId || !description || !amount || !dueDate) {
      return NextResponse.json(
        { error: 'All fields required' },
        { status: 400 }
      )
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // pull name/email server-side rather than trusting the body
    const { data: client, error: clientError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', clientId)
      .eq('role', 'client')
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // retry on invoice_number collisions (23505), bail on anything else
    let attempt = 0
    let data = null
    let lastError = null

    while (attempt < 3 && !data) {
      const invoiceNumber = `INV-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`

      const result = await supabase
        .from('invoices')
        .insert([{
          invoice_number: invoiceNumber,
          client_id: client.id,
          client_name: client.full_name,
          client_email: client.email,
          description,
          amount: Number(amount),
          due_date: new Date(dueDate).toISOString(),
          status: 'pending',
        }])
        .select()
        .single()

      if (result.error) {
        lastError = result.error
        if (result.error.code !== '23505') break
        attempt++
        continue
      }

      data = result.data
    }

    if (!data) {
      console.error(lastError)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }

    return NextResponse.json({ invoice: data })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}