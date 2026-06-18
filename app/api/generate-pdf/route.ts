export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateInvoicePdfBuffer } from '@/lib/generate-invoice-pdf'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceId = req.nextUrl.searchParams.get('invoiceId')
    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const isOwner = invoice.client_id === user.id
    const isAdmin = profile?.role === 'admin'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const pdfBuffer = await generateInvoicePdfBuffer(invoice)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}