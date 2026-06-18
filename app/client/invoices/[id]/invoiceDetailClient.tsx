'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Invoice } from '@/types'
import { toast } from 'sonner'
import {
  ArrowLeft, CreditCard, Download,
  CheckCircle, Clock, AlertCircle, FileText
} from 'lucide-react'

interface Props {
  profile: Profile
  invoice: Invoice
}

const STATUS_STYLE: Record<string, { class: string; icon: React.ReactNode }> = {
  pending: { class: 'bg-amber-100 text-amber-700', icon: <Clock size={14} /> },
  paid: { class: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle size={14} /> },
  overdue: { class: 'bg-red-100 text-red-700', icon: <AlertCircle size={14} /> },
}

export default function InvoiceDetailClient({ profile, invoice }: Props) {
  const router = useRouter()
  const [paying, setPaying] = useState(false)

  const handlePay = async () => {
    if (paying) return
    setPaying(true)

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })

      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
        setPaying(false)
        return
      }

      window.location.href = data.url
    } catch {
      toast.error('Payment failed. Please try again.')
      setPaying(false)
    }
  }

  const handleDownloadPDF = () => {
    const a = document.createElement('a')
    a.href = `/api/generate-pdf?invoiceId=${invoice.id}`
    a.download = `${invoice.invoice_number}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('PDF download started!')
  }

  return (
    <div className="min-h-screen bg-slate-50">

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-screen-md mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/client/invoices')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors bg-transparent border-none cursor-pointer text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Back to invoices
          </button>
        </div>
      </header>

      <div className="max-w-screen-md mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">

          <div className="bg-indigo-600 px-8 py-6">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={18} className="text-white" />
              <span className="text-white font-bold text-lg">VaultPay</span>
            </div>
            <p className="text-indigo-200 text-xs">Nexus Corporate Services</p>
          </div>

          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">
                  Invoice Number
                </p>
                <p className="font-mono text-lg font-bold text-slate-900">
                  {invoice.invoice_number}
                </p>
              </div>
              <span className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${STATUS_STYLE[invoice.status]?.class}`}>
                {STATUS_STYLE[invoice.status]?.icon}
                {invoice.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">
                  Billed To
                </p>
                <p className="text-sm font-semibold text-slate-800">{invoice.client_name}</p>
                <p className="text-sm text-slate-500">{invoice.client_email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">
                  Due Date
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {new Date(invoice.due_date).toLocaleDateString()}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Issued {new Date(invoice.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="mb-6 pb-6 border-b border-slate-100">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">
                Service Description
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {invoice.description}
              </p>
            </div>

            <div className="flex justify-between items-center mb-8">
              <p className="text-sm font-semibold text-slate-500">Total Due</p>
              <p className="text-3xl font-bold text-slate-900">
                ${invoice.amount.toLocaleString()}
              </p>
            </div>

            {invoice.status === 'paid' && invoice.paid_at && (
              <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <p className="text-sm text-emerald-700 font-medium">
                  Paid on {new Date(invoice.paid_at).toLocaleDateString()}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              {invoice.status === 'pending' && (
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors border-none cursor-pointer"
                >
                  {paying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      Pay Invoice
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleDownloadPDF}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-sm font-semibold transition-colors border-none cursor-pointer"
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}