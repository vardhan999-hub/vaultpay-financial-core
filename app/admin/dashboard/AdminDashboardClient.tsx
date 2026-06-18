'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, Invoice } from '@/types'
import { toast } from 'sonner'
import {
  Shield, LogOut, Plus, DollarSign,
  FileText, Users, X, CheckCircle, Clock, AlertCircle, RefreshCw
} from 'lucide-react'

interface Props {
  profile: Profile
  invoices: Invoice[]
  clients: Profile[]
}

const STATUS_STYLE: Record<string, { class: string; icon: React.ReactNode }> = {
  pending: { class: 'bg-amber-100 text-amber-700', icon: <Clock size={12} /> },
  paid: { class: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={12} /> },
  overdue: { class: 'bg-red-100 text-red-700', icon: <AlertCircle size={12} /> },
}

export default function AdminDashboardClient({
  profile,
  invoices,
  clients,
}: Props) {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [checkingOverdue, setCheckingOverdue] = useState(false)
  const [form, setForm] = useState({
    clientId: '',
    description: '',
    amount: '',
    dueDate: '',
  })

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount, 0)

  const pendingCount = invoices.filter(i => i.status === 'pending').length

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleCreateInvoice = async () => {
    if (!form.clientId || !form.description || !form.amount || !form.dueDate) {
      toast.error('All fields are required')
      return
    }

    if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setCreating(true)

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: form.clientId,
        description: form.description,
        amount: Number(form.amount),
        dueDate: form.dueDate,
      }),
    })

    const data = await res.json()

    if (data.error) {
      toast.error(data.error || 'Failed to create invoice')
    } else {
      toast.success(`Invoice ${data.invoice.invoice_number} created!`)
      setShowCreateModal(false)
      setForm({ clientId: '', description: '', amount: '', dueDate: '' })
      router.refresh()
    }

    setCreating(false)
  }

  // flips pending -> overdue for anything past due_date
  const handleCheckOverdue = async () => {
    setCheckingOverdue(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('mark_overdue_invoices')

    if (error) {
      toast.error('Failed to check overdue invoices')
    } else {
      toast.success('Overdue check complete')
      router.refresh()
    }
    setCheckingOverdue(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">VaultPay Admin</h1>
              <p className="text-xs text-slate-400">Nexus Corporate Services</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full font-semibold">
              ADMIN
            </span>
            <span className="text-sm text-slate-600 font-medium">
              {profile.full_name}
            </span>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-indigo-50 rounded-2xl p-5">
            <div className="text-indigo-600 mb-2"><FileText size={20} /></div>
            <div className="text-2xl font-bold text-indigo-600">{invoices.length}</div>
            <div className="text-xs text-slate-500 mt-1">Total Invoices</div>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-5">
            <div className="text-emerald-600 mb-2"><DollarSign size={20} /></div>
            <div className="text-2xl font-bold text-emerald-600">${totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-1">Total Revenue</div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-5">
            <div className="text-amber-600 mb-2"><Clock size={20} /></div>
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <div className="text-xs text-slate-500 mt-1">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-5">
            <div className="text-blue-600 mb-2"><Users size={20} /></div>
            <div className="text-2xl font-bold text-blue-600">{clients.length}</div>
            <div className="text-xs text-slate-500 mt-1">Clients</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">All Invoices</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCheckOverdue}
                disabled={checkingOverdue}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border-none cursor-pointer"
              >
                <RefreshCw size={14} className={checkingOverdue ? 'animate-spin' : ''} />
                Check Overdue
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors border-none cursor-pointer"
              >
                <Plus size={15} />
                New Invoice
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice #</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                      No invoices yet. Create your first invoice.
                    </td>
                  </tr>
                ) : invoices.map((invoice, idx) => (
                  <tr
                    key={invoice.id}
                    className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {invoice.client_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                      {invoice.description}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      ${invoice.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full w-fit ${STATUS_STYLE[invoice.status]?.class}`}>
                        {STATUS_STYLE[invoice.status]?.icon}
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <>
          <div
            onClick={() => setShowCreateModal(false)}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-[90vw] max-w-lg p-7">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900">Create New Invoice</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Client
                </label>
                <select
                  value={form.clientId}
                  onChange={e => setForm({ ...form, clientId: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white focus:border-indigo-400 transition-colors"
                >
                  <option value="">Select a client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} — {c.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Service Description
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Q3 Strategic Consulting Services"
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-indigo-400 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="e.g. 15000"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white text-sm font-semibold transition-colors border-none cursor-pointer"
              >
                {creating ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}