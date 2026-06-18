import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendReceiptParams {
  to: string
  clientName: string
  invoiceNumber: string
  amount: number
  pdfBuffer: Buffer
}

export async function sendInvoiceReceiptEmail({
  to,
  clientName,
  invoiceNumber,
  amount,
  pdfBuffer,
}: SendReceiptParams) {
  try {
    console.log('[EMAIL] Requested recipient:', to)

    console.log(
      '[EMAIL] Sending to hardcoded email:',
      'harshavtadigadapa14@gmail.com'
    )

    console.log(
      '[EMAIL] RESEND_API_KEY exists:',
      !!process.env.RESEND_API_KEY
    )

    const { data, error } = await resend.emails.send({
      from: 'VaultPay <onboarding@resend.dev>',

      // Sandbox mode: send only to your email
      to: 'harshavtadigadapa14@gmail.com',

      subject: `Payment Receipt — ${invoiceNumber}`,

      html: `
        <div style="font-family: Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0;">VaultPay</h1>
            <p style="color: #e0e7ff;">
              Nexus Corporate Services
            </p>
          </div>

          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
            <p>Hi ${clientName},</p>

            <p>
              Your payment for invoice
              <strong>${invoiceNumber}</strong>
              has been received successfully.
            </p>

            <div style="
              background:#f8fafc;
              padding:16px;
              border-radius:8px;
              margin:16px 0;
            ">
              <p style="margin:0;font-size:12px;color:#64748b;">
                AMOUNT PAID
              </p>

              <p style="
                margin:8px 0 0;
                font-size:24px;
                font-weight:bold;
              ">
                $${amount.toLocaleString()}
              </p>
            </div>

            <p>
              Your PDF receipt is attached to this email.
            </p>

            <p style="
              margin-top:24px;
              font-size:12px;
              color:#94a3b8;
            ">
              This is an automated email from VaultPay Financial Core.
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

    console.log('[EMAIL] Resend response:', data)

    if (error) {
      console.error('[EMAIL] Email send failed:', error)

      return {
        success: false,
        error,
      }
    }

    console.log('[EMAIL] Email sent successfully')

    return {
      success: true,
      data,
    }
  } catch (err) {
    console.error('[EMAIL] Email send exception:', err)

    return {
      success: false,
      error: err,
    }
  }
}
