export type UserRole = 'admin' | 'client'
export type InvoiceStatus = 'pending' | 'paid' | 'overdue'
export type PaymentStatus = 'completed' | 'failed' | 'refunded'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  company: string | null
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  client_name: string
  client_email: string
  description: string
  amount: number
  status: InvoiceStatus
  due_date: string
  paid_at: string | null
  active_stripe_session_id: string | null
  stripe_session_id: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  invoice_id: string
  stripe_session_id: string | null
  amount: number
  status: PaymentStatus
  created_at: string
}