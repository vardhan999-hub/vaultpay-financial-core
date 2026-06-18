import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendReceiptParams {
  to: string
  clientName: string
  invoiceNumber: string
  amount: number
  pdfBuffer: Buffer
}

// HV: sends PDF receipt as an email attachment after successful payment
// failure here is logged but never blocks the webhook response to Stripe
export async function sendInvoiceReceiptEmail({
  to,
  clientName,
  invoiceNumber,
  amount,
  pdfBuffer,
}: SendReceiptParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'VaultPay <onboarding@resend.dev>',
      to,
      subject: `Payment Receipt — ${invoiceNumber}`,
      html: `
        <div style="font-family: Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px;">VaultPay</h1>
            <p style="color: #e0e7ff; margin: 4px 0 0; font-size: 13px;">Nexus Corporate Services</p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #1e293b; font-size: 15px;">Hi ${clientName},</p>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">
              Your payment for invoice <strong>${invoiceNumber}</strong> has been received successfully.
            </p>
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; font-weight: bold;">AMOUNT PAID</p>
              <p style="margin: 4px 0 0; color: #1e293b; font-size: 20px; font-weight: bold;">$${amount.toLocaleString()}</p>
            </div>
            <p style="color: #475569; font-size: 13px;">
              Your PDF receipt is attached to this email for your records.
            </p>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">
              This is an automated receipt from VaultPay Financial Core.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    if (error) {
      console.error('Email send failed:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (err) {
    console.error('Email send exception:', err)
    return { success: false, error: err }
  }
}