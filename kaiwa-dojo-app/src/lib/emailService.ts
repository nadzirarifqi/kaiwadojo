/**
 * Service khusus pengiriman email Notifikasi Persetujuan Admin (Approval Email)
 * menggunakan Resend API.
 * 
 * Anda dapat mengedit judul, teks, dan template HTML email persetujuan di file ini.
 */

export interface ApprovalEmailParams {
  toEmail: string
  fullName: string
  username: string
}

export async function sendApprovalEmail({ toEmail, fullName, username }: ApprovalEmailParams): Promise<boolean> {
  const resendApiKey = import.meta.env.VITE_RESEND_API_KEY || ''

  // Template HTML Email Persetujuan Akun oleh Admin
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Akun KaiwaDojo Disetujui</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header Branding -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background-color: #fef2f2; padding: 12px; border-radius: 16px; margin-bottom: 8px;">
            <span style="font-size: 36px;">🎉</span>
          </div>
          <h1 style="color: #b91c1c; margin: 0; font-size: 24px; font-weight: 900;">KaiwaDoJo</h1>
          <p style="color: #64748b; font-size: 11px; margin-top: 4px; uppercase; font-weight: 800; letter-spacing: 1px;">Platform Interaktif Belajar Bahasa Jepang</p>
        </div>

        <!-- Notification Content -->
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 18px; border-radius: 16px; margin-bottom: 24px; text-align: center;">
          <span style="color: #166534; font-size: 14px; font-weight: 800;">✅ Selamat! Akun Anda Telah Disetujui Admin</span>
        </div>

        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">Halo <strong>${fullName}</strong>,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          Pendaftaran akun Anda di <strong>KaiwaDojo</strong> telah berhasil diverifikasi dan <strong>disetujui oleh Admin</strong>.
        </p>

        <!-- Account Info Card -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 16px; margin-bottom: 24px;">
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: bold;">Detail Login Anda:</p>
          <p style="margin: 0; font-size: 14px; color: #0f172a;"><strong>Username:</strong> @${username}</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #0f172a;"><strong>Email:</strong> ${toEmail}</p>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin-top: 28px; margin-bottom: 24px;">
          <a href="https://kaiwadojo.inaconnext.it.com/login" style="display: inline-block; background-color: #b91c1c; color: #ffffff; padding: 14px 32px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 14px;">
            Masuk ke Dashboard Sekarang →
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        
        <!-- Footer -->
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.5;">
          Email ini dikirimkan secara otomatis oleh sistem KaiwaDojo.<br />
          Jika Anda memiliki pertanyaan, silakan hubungi tim pengelola.
        </p>
      </div>
    </body>
    </html>
  `

  if (!resendApiKey) {
    console.warn('VITE_RESEND_API_KEY belum diset. Simulasi pengiriman email approval berhasil ke:', toEmail)
    return true
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'KaiwaDojo Admin <onboarding@resend.dev>',
        to: [toEmail],
        subject: '🎉 Selamat! Akun KaiwaDojo Anda Telah Disetujui Admin',
        html: emailHtml,
      }),
    })

    if (res.ok) {
      console.log('Email approval berhasil dikirim via Resend ke:', toEmail)
      return true
    } else {
      const errJson = await res.json()
      console.warn('Resend API response note:', errJson)
      return false
    }
  } catch (err) {
    console.error('Error sending approval email via Resend:', err)
    return false
  }
}
