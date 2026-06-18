'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, Invoice } from '@/types'
import { toast } from 'sonner'
import {
  FileText, LogOut, CreditCard,
  Download, CheckCircle, Clock, AlertCircle
} from 'lucide-react'

interface Props {
  profile: Profile
  invoices: Invoice[]
}

const STATUS_STYLE: Record<string, { class: string; icon: React.ReactNode }> = {
  pending: { class: 'bg-amber-100 text-amber-700', icon: <Clock size={12} /> },
  paid: { class: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={12} /> },
  overdue: { class: 'bg-red-100 text-red-700', icon: <AlertCircle size={12} /> },
}

export default function ClientInvoicesClient({ profile, invoices }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [payingId, setPayingId] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      toast.success('Payment successful! A receipt has been emailed to you.')
    }
  }, [searchParams])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handlePay = async (invoice: Invoice) => {
    if (payingId) return
    setPayingId(invoice.id)

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })

      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
        setPayingId(null)
        return
      }

      window.location.href = data.url
    } catch {
      toast.error('Payment failed. Please try again.')
      setPayingId(null)
    }
  }

  const handleDownloadPDF = (invoice: Invoice) => {
    const a = document.createElement('a')
    a.href = `/api/generate-pdf?invoiceId=${invoice.id}`
    a.download = `${invoice.invoice_number}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('PDF download started!')
  }

  const totalOutstanding = invoices
    .filter(i => i.status === 'pending')
    .reduce((sum, i) => sum + i.amount, 0)

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">VaultPay</h1>
              <p className="text-xs text-slate-400">Your Billing Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium">
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

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Invoices', value: invoices.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Outstanding', value: `$${totalOutstanding.toLocaleString()}`, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Paid', value: invoices.filter(i => i.status === 'paid').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl p-5 text-center`}>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* INVOICES LIST */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">Your Invoices</h2>
          </div>

          {invoices.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={32} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No invoices yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {invoices.map(invoice => (
                <div
                  key={invoice.id}
                  onClick={() => router.push(`/client/invoices/${invoice.id}`)}
                  className="px-6 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-400">
                        {invoice.invoice_number}
                      </span>
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[invoice.status]?.class}`}>
                        {STATUS_STYLE[invoice.status]?.icon}
                        {invoice.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {invoice.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Due {new Date(invoice.due_date).toLocaleDateString('en-US')}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-slate-900 mb-2">
                      ${invoice.amount.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {invoice.status === 'pending' && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePay(invoice) }}
                          disabled={!!payingId}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border-none cursor-pointer"
                        >
                          {payingId === invoice.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CreditCard size={12} />
                              Pay Now
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownloadPDF(invoice) }}
                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border-none cursor-pointer"
                      >
                        <Download size={12} />
                        PDF
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}