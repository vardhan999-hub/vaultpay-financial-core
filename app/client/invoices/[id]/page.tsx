import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import InvoiceDetailClient from './invoiceDetailClient'

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()

  const authResult = await supabase.auth.getUser()
  const user = authResult.data.user

  if (!user) {
    redirect('/login')
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  if (profile.role === 'admin') {
    redirect('/admin/dashboard')
  }

  // RLS prevents users from accessing invoices they don't own.
  const {
    data: invoice,
    error: invoiceError,
  } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (invoiceError) {
    console.error('Invoice fetch error:', invoiceError)
  }

  if (!invoice) {
    notFound()
  }

  return (
    <InvoiceDetailClient
      profile={profile}
      invoice={invoice}
    />
  )
}