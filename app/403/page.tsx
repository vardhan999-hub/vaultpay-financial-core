import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <ShieldX size={36} className="text-red-500 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">You don't have access to this page</h1>
        <p className="text-slate-400 text-sm mb-8">
          If you think this is a mistake, contact your admin or sign in with a different account.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  )
}