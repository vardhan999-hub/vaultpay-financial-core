import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientInvoicesClient from './ClientInvoicesClient'

export default async function ClientInvoicesPage() {
  const supabase = await createClient()

  const authResponse = await supabase.auth.getUser()
  const user = authResponse.data.user

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

  const {
    data: invoices,
    error: invoicesError,
  } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', user.id)
    .order('created_at', {
      ascending: false,
    })

  if (invoicesError) {
    console.error('Failed to fetch invoices:', invoicesError)
  }

  return (
    <ClientInvoicesClient
      profile={profile}
      invoices={invoices ?? []}
    />
  )
}