// POST /api/event-bookings/send-signing
//
// mode=undefined        — Admin sends vendor agreement → email vendor signing link
// mode='admin_notify'   — Vendor signed → notify admin
// mode='insurance_deferred' — Vendor deferred insurance → remind admin

import { sendResendEmail } from '../_email.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY

const EVENT = {
  name: 'Found Underground',
  date: 'Sunday 7 June 2026',
  hours: '3:00 PM – 9:00 PM',
  venue: 'The Hub, 18 Logistic Court, Huntingdale VIC 3166',
}

function frame(bodyHtml) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#f5f5f5">
<div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
  <div style="background:#000;padding:24px 32px">
    <span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:3px">HEXAHUB</span>
    <span style="color:#666;font-size:12px;margin-left:12px">Found Underground · 7 June 2026</span>
  </div>
  <div style="padding:32px">${bodyHtml}</div>
  <div style="background:#f5f5f5;padding:16px 32px;border-top:1px solid #eee">
    <p style="color:#999;font-size:11px;margin:0;text-align:center">
      HexaHub Pty Ltd &nbsp;·&nbsp; 402/830 Whitehorse Road, Box Hill VIC 3128<br>
      <em>build locally, scale sustainably</em> &nbsp;·&nbsp;
      <a href="https://hexahub.com.au" style="color:#999">hexahub.com.au</a>
    </p>
  </div>
</div></body></html>`
}

function buildVendorSigningEmail({ booking, signingUrl }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const body = `
    <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Vendor Participation Agreement</p>
    <h2 style="font-size:20px;color:#111;margin:0 0 20px">Hi ${booking.vendorName} — please review &amp; sign your vendor agreement</h2>
    <p style="font-size:14px;color:#555;margin:0 0 20px">
      We're excited to have <strong>${vendor}</strong> joining us at the <strong>Found Underground on 7 June 2026</strong>.
      Before the event, please review and sign the Vendor Participation Agreement, Liability Waiver, and Venue Rules using the button below.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px">
      <tr><td style="padding:8px 0;color:#888;width:130px">Event</td><td style="padding:8px 0;font-weight:600;color:#111">${EVENT.name}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Date</td><td style="padding:8px 0;color:#111">${EVENT.date}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Hours</td><td style="padding:8px 0;color:#111">${EVENT.hours}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Venue</td><td style="padding:8px 0;color:#111">${EVENT.venue}</td></tr>
      ${booking.vendorType ? `<tr><td style="padding:8px 0;color:#888">Vendor Type</td><td style="padding:8px 0;color:#111">${booking.vendorType}</td></tr>` : ''}
      ${booking.allocatedSpace ? `<tr><td style="padding:8px 0;color:#888">Allocated Space</td><td style="padding:8px 0;color:#111">${booking.allocatedSpace}</td></tr>` : ''}
    </table>
    <div style="text-align:center;margin:28px 0">
      <a href="${signingUrl}"
         style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;font-size:14px;font-weight:700;border-radius:6px">
        Review &amp; Sign Documents
      </a>
    </div>
    <p style="font-size:12px;color:#999;margin:0 0 12px">
      If the button doesn't work, copy this link:<br>
      <a href="${signingUrl}" style="color:#888;word-break:break-all">${signingUrl}</a>
    </p>
    <p style="font-size:12px;color:#bbb;margin:0">
      After signing, you'll be asked to submit a Certificate of Currency for Public Liability Insurance (min. AUD $10,000,000). Please have this ready.
      Any questions? Reply to this email or contact <a href="mailto:info@hexahub.com.au" style="color:#888">info@hexahub.com.au</a>.
    </p>`
  return frame(body)
}

function buildAdminNotifyEmail({ booking }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const body = `
    <h2 style="font-size:18px;color:#111;margin:0 0 16px">Vendor Agreement Signed ✅</h2>
    <p style="font-size:14px;color:#555;margin:0 0 20px">
      <strong>${vendor}</strong> has signed their vendor agreement for the <strong>Found Underground</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      <tr><td style="padding:8px 0;color:#888;width:130px">Ref</td><td style="padding:8px 0;font-weight:600;color:#111">${booking.ref}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Vendor</td><td style="padding:8px 0;color:#111">${vendor}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Vendor Type</td><td style="padding:8px 0;color:#111">${booking.vendorType || '—'}</td></tr>
      ${booking.allocatedSpace ? `<tr><td style="padding:8px 0;color:#888">Space</td><td style="padding:8px 0;color:#111">${booking.allocatedSpace}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#888">Signed by</td><td style="padding:8px 0;color:#111">${booking.signerName}${booking.signerTitle ? ` — ${booking.signerTitle}` : ''}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Email</td><td style="padding:8px 0;color:#111">${booking.vendorEmail}</td></tr>
    </table>
    <p style="font-size:13px;color:#555;margin:0 0 16px">
      The vendor has been asked to submit their Certificate of Currency. Check the admin portal to confirm insurance status.
    </p>
    <a href="https://app.hexahub.com.au/event-bookings"
       style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;font-size:13px;font-weight:700;border-radius:6px">
      Open Admin Portal →
    </a>`
  return frame(body)
}

function buildSpaceAssignedEmail({ booking }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const space = booking.allocatedSpace
  const body = `
    <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Found Underground · Space Confirmed</p>
    <h2 style="font-size:20px;color:#111;margin:0 0 20px">Your space has been assigned, ${booking.vendorName}!</h2>
    <p style="font-size:14px;color:#555;margin:0 0 24px">
      Great news — your vendor space at the Found Underground has been confirmed. Here are your details:
    </p>
    <div style="background:#f5f5f5;border-radius:6px;padding:20px 24px;margin-bottom:28px">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Your Allocated Space</div>
      <div style="font-size:28px;font-weight:900;color:#111;letter-spacing:-0.5px">${space}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px">
      <tr><td style="padding:8px 0;color:#888;width:130px">Event</td><td style="padding:8px 0;font-weight:600;color:#111">${EVENT.name}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Date</td><td style="padding:8px 0;color:#111">${EVENT.date}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Hours</td><td style="padding:8px 0;color:#111">${EVENT.hours}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Venue</td><td style="padding:8px 0;color:#111">${EVENT.venue}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Bump-In From</td><td style="padding:8px 0;color:#111">11:00 AM</td></tr>
      ${booking.vendorType ? `<tr><td style="padding:8px 0;color:#888">You are</td><td style="padding:8px 0;color:#111">${booking.vendorType}</td></tr>` : ''}
    </table>
    <p style="font-size:13px;color:#555;margin:0 0 8px">
      If you have any questions about your space or the event, reply to this email or contact us at
      <a href="mailto:info@hexahub.com.au" style="color:#111">info@hexahub.com.au</a>.
    </p>
    <p style="font-size:13px;color:#555;margin:0">See you on June 7! 🏁</p>`
  return frame(body)
}

function buildInsuranceUploadedEmail({ booking }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const body = `
    <h2 style="font-size:18px;color:#111;margin:0 0 16px">Insurance Certificate Uploaded ✅</h2>
    <p style="font-size:14px;color:#555;margin:0 0 20px">
      <strong>${vendor}</strong> has uploaded their Certificate of Currency for the Found Underground.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      <tr><td style="padding:8px 0;color:#888;width:130px">Vendor</td><td style="padding:8px 0;color:#111">${vendor}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Ref</td><td style="padding:8px 0;color:#111">${booking.ref}</td></tr>
      <tr><td style="padding:8px 0;color:#888">File</td><td style="padding:8px 0;color:#111">${booking.insuranceFileName || 'Certificate uploaded'}</td></tr>
    </table>
    ${booking.insuranceUrl ? `<a href="${booking.insuranceUrl}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 28px;font-size:13px;font-weight:700;border-radius:6px">View Certificate →</a>` : ''}
    <p style="font-size:12px;color:#888;margin:16px 0 0">Please review the certificate and mark the vendor as confirmed in the admin portal.</p>`
  return frame(body)
}

function buildSigningReminderEmail({ booking, signingUrl }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const body = `
    <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Friendly Reminder · Vendor Participation Agreement</p>
    <h2 style="font-size:20px;color:#111;margin:0 0 20px">Hi ${booking.vendorName} — just a reminder to sign your vendor agreement</h2>
    <p style="font-size:14px;color:#555;margin:0 0 20px">
      We noticed you haven't had a chance to sign yet. Here's your link — it only takes a few minutes.
      Please review and sign the Vendor Participation Agreement, Liability Waiver, and Venue Rules using the button below.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px">
      <tr><td style="padding:8px 0;color:#888;width:130px">Event</td><td style="padding:8px 0;font-weight:600;color:#111">${EVENT.name}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Date</td><td style="padding:8px 0;color:#111">${EVENT.date}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Hours</td><td style="padding:8px 0;color:#111">${EVENT.hours}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Venue</td><td style="padding:8px 0;color:#111">${EVENT.venue}</td></tr>
      ${booking.vendorType ? `<tr><td style="padding:8px 0;color:#888">Vendor Type</td><td style="padding:8px 0;color:#111">${booking.vendorType}</td></tr>` : ''}
      ${booking.allocatedSpace ? `<tr><td style="padding:8px 0;color:#888">Allocated Space</td><td style="padding:8px 0;color:#111">${booking.allocatedSpace}</td></tr>` : ''}
    </table>
    <div style="text-align:center;margin:28px 0">
      <a href="${signingUrl}"
         style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;font-size:14px;font-weight:700;border-radius:6px">
        Review &amp; Sign Documents
      </a>
    </div>
    <p style="font-size:12px;color:#999;margin:0 0 12px">
      If the button doesn't work, copy this link:<br>
      <a href="${signingUrl}" style="color:#888;word-break:break-all">${signingUrl}</a>
    </p>
    <p style="font-size:12px;color:#bbb;margin:0">
      After signing, you'll be asked to submit a Certificate of Currency for Public Liability Insurance (min. AUD $10,000,000).
      Any questions? Reply to this email or contact <a href="mailto:info@hexahub.com.au" style="color:#888">info@hexahub.com.au</a>.
    </p>`
  return frame(body)
}

function buildInsuranceReminderEmail({ booking, signingUrl }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const body = `
    <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Action Required · Insurance Certificate</p>
    <h2 style="font-size:20px;color:#111;margin:0 0 20px">Hi ${booking.vendorName} — please upload your insurance certificate</h2>
    <p style="font-size:14px;color:#555;margin:0 0 20px">
      Thanks for signing your Vendor Participation Agreement for the <strong>Found Underground on 7 June 2026</strong>.
      We're following up to request your <strong>Certificate of Currency for Public Liability Insurance</strong> (minimum AUD $10,000,000).
    </p>
    ${signingUrl ? `
    <div style="text-align:center;margin:28px 0">
      <a href="${signingUrl}"
         style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;font-size:14px;font-weight:700;border-radius:6px">
        Upload Insurance Certificate
      </a>
    </div>
    <p style="font-size:12px;color:#999;margin:0 0 20px">
      If the button doesn't work, copy this link:<br>
      <a href="${signingUrl}" style="color:#888;word-break:break-all">${signingUrl}</a>
    </p>` : ''}
    <div style="background:#fff8ed;border:1px solid #ffe4b2;border-radius:6px;padding:16px 20px;margin:0 0 20px">
      <p style="font-size:13px;color:#92600a;margin:0;font-weight:600">Don't have Public Liability Insurance?</p>
      <p style="font-size:13px;color:#92600a;margin:8px 0 0">
        Contact <strong>Jitesh on 0404 339 815</strong> and he'll organise a one-day policy for you.
      </p>
    </div>
    <p style="font-size:12px;color:#bbb;margin:0">
      Alternatively, you can email your certificate directly to <a href="mailto:info@hexahub.com.au" style="color:#888">info@hexahub.com.au</a>.
      Please reference your business name in the subject line.
    </p>`
  return frame(body)
}

function buildAgreementCopyEmail({ booking }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const body = `
    <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Found Underground · Signed Agreement</p>
    <h2 style="font-size:20px;color:#111;margin:0 0 20px">Your signed agreement is ready, ${booking.vendorName}</h2>
    <p style="font-size:14px;color:#555;margin:0 0 20px">
      Thank you for signing your Vendor Participation Agreement for the <strong>Found Underground on 7 June 2026</strong>.
      Your countersigned copy is ready to download and keep for your records.
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="${booking.agreementPdfUrl}"
         style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;font-size:14px;font-weight:700;border-radius:6px">
        Download Signed Agreement (PDF)
      </a>
    </div>
    <p style="font-size:12px;color:#999;margin:0 0 20px">
      If the button doesn't work, copy this link:<br>
      <a href="${booking.agreementPdfUrl}" style="color:#888;word-break:break-all">${booking.agreementPdfUrl}</a>
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px">
      <tr><td style="padding:8px 0;color:#888;width:130px">Ref</td><td style="padding:8px 0;font-weight:600;color:#111">${booking.ref}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Business</td><td style="padding:8px 0;color:#111">${vendor}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Signed by</td><td style="padding:8px 0;color:#111">${booking.signerName}${booking.signerTitle ? ` — ${booking.signerTitle}` : ''}</td></tr>
      ${booking.allocatedSpace ? `<tr><td style="padding:8px 0;color:#888">Allocated Space</td><td style="padding:8px 0;color:#111">${booking.allocatedSpace}</td></tr>` : ''}
    </table>
    <p style="font-size:13px;color:#555;margin:0 0 8px">
      Next step: please upload your <strong>Certificate of Currency for Public Liability Insurance</strong> (minimum AUD $10,000,000)
      if you haven't already. Don't have PLI? Contact Jitesh on <strong>0404 339 815</strong>.
    </p>
    <p style="font-size:13px;color:#555;margin:0">See you on June 7! 🏁</p>`
  return frame(body)
}

const EVENT_DOCS = {
  rundown: {
    label: 'Event Rundown',
    url: process.env.SUPABASE_URL + '/storage/v1/object/public/event-insurance/event-docs/rundown.docx',
  },
  map: {
    label: 'Vendor Map',
    url: process.env.SUPABASE_URL + '/storage/v1/object/public/event-insurance/event-docs/vendor-map.pdf',
  },
}

function buildEventDocsEmail({ booking }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const body = `
    <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Found Underground · Event Documents</p>
    <h2 style="font-size:20px;color:#111;margin:0 0 16px">Hi ${booking.vendorName} — your event documents are ready</h2>
    <p style="font-size:14px;color:#555;margin:0 0 24px">
      We're getting excited for <strong>Sunday 7 June 2026</strong>! Please find your event documents below.
      Review these carefully before the day.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      <tr><td style="padding:8px 0;color:#888;width:130px">Event</td><td style="padding:8px 0;font-weight:600;color:#111">${EVENT.name}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Date</td><td style="padding:8px 0;color:#111">${EVENT.date}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Hours</td><td style="padding:8px 0;color:#111">${EVENT.hours}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Venue</td><td style="padding:8px 0;color:#111">${EVENT.venue}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Bump-In From</td><td style="padding:8px 0;color:#111">11:00 AM</td></tr>
      ${booking.allocatedSpace ? `<tr><td style="padding:8px 0;color:#888">Your Space</td><td style="padding:8px 0;font-weight:600;color:#111">${booking.allocatedSpace}</td></tr>` : ''}
    </table>
    <div style="display:flex;flex-direction:column;gap:12px;margin:0 0 28px">
      <a href="${EVENT_DOCS.rundown.url}"
         style="display:block;border:1px solid #e5e5e5;border-radius:6px;padding:16px 20px;text-decoration:none;color:#111">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Event Rundown</div>
        <div style="font-size:14px;font-weight:700;color:#111">Download Rundown →</div>
      </a>
      <a href="${EVENT_DOCS.map.url}"
         style="display:block;border:1px solid #e5e5e5;border-radius:6px;padding:16px 20px;text-decoration:none;color:#111">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Vendor Map</div>
        <div style="font-size:14px;font-weight:700;color:#111">Download Map →</div>
      </a>
    </div>
    <p style="font-size:13px;color:#555;margin:0 0 8px">
      If you have any questions, reply to this email or contact us at
      <a href="mailto:info@hexahub.com.au" style="color:#111">info@hexahub.com.au</a>.
    </p>
    <p style="font-size:13px;color:#555;margin:0">See you on June 7! 🏁</p>`
  return frame(body)
}

function buildExecutedAgreementEmail({ booking }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const licensorName = booking.licensorSignerName || 'HexaHub Pty Ltd'
  const body = `
    <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Found Underground · Fully Executed Agreement</p>
    <h2 style="font-size:20px;color:#111;margin:0 0 20px">Your agreement is fully executed, ${booking.vendorName}!</h2>
    <p style="font-size:14px;color:#555;margin:0 0 20px">
      Your Vendor Participation Agreement for the <strong>Found Underground on 7 June 2026</strong> has been
      countersigned by <strong>${licensorName}</strong> on behalf of HexaHub. The agreement is now fully executed.
      Please download your copy for your records.
    </p>
    <div style="text-align:center;margin:28px 0">
      <a href="${booking.agreementPdfUrl}"
         style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;font-size:14px;font-weight:700;border-radius:6px">
        Download Executed Agreement (PDF)
      </a>
    </div>
    <p style="font-size:12px;color:#999;margin:0 0 20px">
      If the button doesn't work, copy this link:<br>
      <a href="${booking.agreementPdfUrl}" style="color:#888;word-break:break-all">${booking.agreementPdfUrl}</a>
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px">
      <tr><td style="padding:8px 0;color:#888;width:130px">Ref</td><td style="padding:8px 0;font-weight:600;color:#111">${booking.ref}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Business</td><td style="padding:8px 0;color:#111">${vendor}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Signed by</td><td style="padding:8px 0;color:#111">${booking.signerName}${booking.signerTitle ? ` — ${booking.signerTitle}` : ''}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Countersigned by</td><td style="padding:8px 0;color:#111">${licensorName}${booking.licensorSignerTitle ? ` — ${booking.licensorSignerTitle}` : ''}</td></tr>
      ${booking.allocatedSpace ? `<tr><td style="padding:8px 0;color:#888">Allocated Space</td><td style="padding:8px 0;color:#111">${booking.allocatedSpace}</td></tr>` : ''}
    </table>
    <p style="font-size:13px;color:#555;margin:0 0 8px">
      We're looking forward to having you at the event. See you on June 7! 🏁
    </p>
    <p style="font-size:12px;color:#bbb;margin:0">
      Questions? Reply to this email or contact <a href="mailto:info@hexahub.com.au" style="color:#888">info@hexahub.com.au</a>.
    </p>`
  return frame(body)
}

function buildInsuranceDeferredEmail({ booking }) {
  const vendor = booking.vendorBusiness || booking.vendorName
  const body = `
    <h2 style="font-size:18px;color:#111;margin:0 0 16px">Insurance Pending — Follow Up Required ⚠️</h2>
    <p style="font-size:14px;color:#555;margin:0 0 20px">
      <strong>${vendor}</strong> has indicated they will email their Certificate of Currency separately.
      Please follow up to ensure it is received before the event date.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
      <tr><td style="padding:8px 0;color:#888;width:130px">Vendor</td><td style="padding:8px 0;color:#111">${vendor}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Email</td><td style="padding:8px 0;color:#111">${booking.vendorEmail}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Ref</td><td style="padding:8px 0;color:#111">${booking.ref}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Requirement</td><td style="padding:8px 0;color:#111">Min. AUD $10,000,000 Public Liability Insurance</td></tr>
    </table>
    <p style="font-size:12px;color:#888;margin:0">
      Once received, mark the vendor as "Insurance Received" in the admin portal.
    </p>`
  return frame(body)
}

async function sendMail({ to, subject, html }) {
  const r = await sendResendEmail({
    from: 'HexaHub <info@hexahub.com.au>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })
  return r.ok
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'Email not configured.' })

  const { booking, signingUrl, mode } = req.body
  if (!booking) return res.status(400).json({ error: 'Missing booking.' })

  try {
    if (!mode) {
      if (!booking.vendorEmail) return res.status(400).json({ error: 'No vendor email.' })
      if (!signingUrl) return res.status(400).json({ error: 'Missing signingUrl.' })

      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: booking.vendorEmail,
        subject: `Vendor Agreement — Found Underground · ${vendor}`,
        html: buildVendorSigningEmail({ booking, signingUrl }),
      })
      return res.status(ok ? 200 : 500).json({ sent: ok })
    }

    if (mode === 'admin_notify') {
      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: 'info@hexahub.com.au',
        subject: `Vendor signed: ${vendor} — Found Underground`,
        html: buildAdminNotifyEmail({ booking }),
      })
      return res.status(200).json({ sent: ok })
    }

    if (mode === 'space_assigned') {
      if (!booking.vendorEmail) return res.status(400).json({ error: 'No vendor email.' })
      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: booking.vendorEmail,
        subject: `Your space is confirmed — ${booking.allocatedSpace} · Found Underground`,
        html: buildSpaceAssignedEmail({ booking }),
      })
      return res.status(200).json({ sent: ok })
    }

    if (mode === 'insurance_uploaded') {
      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: 'info@hexahub.com.au',
        subject: `Insurance uploaded: ${vendor} — Found Underground`,
        html: buildInsuranceUploadedEmail({ booking }),
      })
      return res.status(200).json({ sent: ok })
    }

    if (mode === 'executed_agreement') {
      if (!booking.vendorEmail) return res.status(400).json({ error: 'No vendor email.' })
      if (!booking.agreementPdfUrl) return res.status(400).json({ error: 'No PDF URL.' })
      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: booking.vendorEmail,
        subject: `Fully executed agreement — Found Underground · ${vendor}`,
        html: buildExecutedAgreementEmail({ booking }),
      })
      return res.status(200).json({ sent: ok })
    }

    if (mode === 'agreement_copy') {
      if (!booking.vendorEmail) return res.status(400).json({ error: 'No vendor email.' })
      if (!booking.agreementPdfUrl) return res.status(400).json({ error: 'No PDF URL.' })
      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: booking.vendorEmail,
        subject: `Your signed agreement — Found Underground · ${vendor}`,
        html: buildAgreementCopyEmail({ booking }),
      })
      return res.status(200).json({ sent: ok })
    }

    if (mode === 'signing_reminder') {
      if (!booking.vendorEmail) return res.status(400).json({ error: 'No vendor email.' })
      if (!signingUrl) return res.status(400).json({ error: 'Missing signingUrl.' })
      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: booking.vendorEmail,
        subject: `Reminder: Please sign your vendor agreement — Found Underground · ${vendor}`,
        html: buildSigningReminderEmail({ booking, signingUrl }),
      })
      return res.status(200).json({ sent: ok })
    }

    if (mode === 'insurance_reminder') {
      if (!booking.vendorEmail) return res.status(400).json({ error: 'No vendor email.' })
      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: booking.vendorEmail,
        subject: `Insurance required: Please upload your certificate — Found Underground · ${vendor}`,
        html: buildInsuranceReminderEmail({ booking, signingUrl }),
      })
      return res.status(200).json({ sent: ok })
    }

    if (mode === 'event_docs') {
      if (!booking.vendorEmail) return res.status(400).json({ error: 'No vendor email.' })
      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: booking.vendorEmail,
        subject: `Event documents — Found Underground · ${vendor}`,
        html: buildEventDocsEmail({ booking }),
      })
      return res.status(200).json({ sent: ok })
    }

    if (mode === 'insurance_deferred') {
      const vendor = booking.vendorBusiness || booking.vendorName
      const ok = await sendMail({
        to: 'info@hexahub.com.au',
        subject: `Insurance pending: ${vendor} — Found Underground`,
        html: buildInsuranceDeferredEmail({ booking }),
      })
      return res.status(200).json({ sent: ok })
    }

    return res.status(400).json({ error: 'Unknown mode.' })
  } catch (err) {
    console.error('send-signing error:', err)
    return res.status(500).json({ error: 'Internal error.' })
  }
}
