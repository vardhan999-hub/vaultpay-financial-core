'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter your email and password')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (authError) {
        toast.error(authError.message)
        return
      }

      const user = authData.user

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        toast.error('Profile not found')
        return
      }

      toast.success('Login successful')

      router.push(
        profile.role === 'admin'
          ? '/admin/dashboard'
          : '/client/invoices'
      )
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-white" />
          </div>

          <h1 className="text-2xl font-bold text-white">
            VaultPay
          </h1>

          <p className="text-slate-400 text-sm mt-1">
            Financial Core — Nexus Corporate Services
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">

          <h2 className="text-lg font-semibold text-white mb-6">
            Sign in to your account
          </h2>

          <div className="space-y-4">

            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Email Address
              </label>

              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Password
              </label>

              <div className="relative">

                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLogin()
                    }
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-indigo-500"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>
            </div>

          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800 p-4">
              <p className="mb-2 text-xs font-semibold text-slate-400">
                TEST CREDENTIALS (DEV ONLY)
              </p>

              <p className="text-xs text-slate-300">
                Admin: admin@vaultpay.com / Admin@123
              </p>

              <p className="text-xs text-slate-300">
                Client: client@nexus.com / Client@123
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}