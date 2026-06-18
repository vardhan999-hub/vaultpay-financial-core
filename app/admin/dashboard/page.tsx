import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/403')

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: clients } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'client')

  return (
    <AdminDashboardClient
      profile={profile}
      invoices={invoices || []}
      clients={clients || []}
    />
  )
}