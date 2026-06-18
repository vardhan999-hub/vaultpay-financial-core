import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Invoice } from '@/types'

export async function generateInvoicePdfBuffer(
  invoice: Invoice
): Promise<Buffer> {
  const pdf = await PDFDocument.create()

  const page = pdf.addPage([595, 842])

  const regularFont = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const marginX = 50

  page.drawText('VaultPay', {
    x: marginX,
    y: 780,
    size: 28,
    font: boldFont,
    color: rgb(0.31, 0.27, 0.89),
  })

  page.drawText('INVOICE', {
    x: marginX,
    y: 730,
    size: 20,
    font: boldFont,
  })

  page.drawText(
    `Invoice #: ${invoice.invoice_number}`,
    {
      x: marginX,
      y: 700,
      size: 12,
      font: regularFont,
    }
  )

  page.drawText(
    `Client: ${invoice.client_name}`,
    {
      x: marginX,
      y: 660,
      size: 12,
      font: regularFont,
    }
  )

  page.drawText(
    `Email: ${invoice.client_email}`,
    {
      x: marginX,
      y: 640,
      size: 12,
      font: regularFont,
    }
  )

  page.drawText(
    `Description: ${invoice.description}`,
    {
      x: marginX,
      y: 600,
      size: 12,
      font: regularFont,
    }
  )

  page.drawText(
    `Amount: $${invoice.amount.toLocaleString()}`,
    {
      x: marginX,
      y: 560,
      size: 18,
      font: boldFont,
    }
  )

  page.drawText(
    `Status: ${invoice.status.toUpperCase()}`,
    {
      x: marginX,
      y: 520,
      size: 12,
      font: boldFont,
    }
  )

  if (invoice.paid_at) {
    page.drawText(
      `Paid At: ${new Date(invoice.paid_at).toLocaleDateString()}`,
      {
        x: marginX,
        y: 490,
        size: 12,
        font: regularFont,
      }
    )
  }

  const pdfBytes = await pdf.save()

  return Buffer.from(pdfBytes)
}