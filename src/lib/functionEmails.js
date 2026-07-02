// Default subject + HTML for the editable function-space emails. Pure strings
// (no imports) so both the browser store (SAMPLE_TEMPLATES) and the serverless
// sender can use them. Editable in Templates → Emails; the send endpoint uses
// the saved template if present, else falls back to these.
//
// Placeholders: {{company}} {{name}} {{organisation}} {{eventName}} {{eventType}}
// {{eventDate}} {{startTime}} {{endTime}} {{guests}} {{total}} {{dueNow}}
// {{balanceDue}} {{signLink}} {{website}}

function frame(inner) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:0;background:#f5f5f5">
<div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
  <div style="background:#000;padding:24px 32px"><span style="color:#fff;font-size:18px;font-weight:900;letter-spacing:3px">HEXA SPACE</span>
    <span style="color:#888;font-size:12px;margin-left:12px">Function Space Hire</span></div>
  <div style="padding:32px">${inner}</div>
  <div style="background:#f5f5f5;padding:16px 32px;border-top:1px solid #eee">
    <p style="color:#999;font-size:11px;margin:0;text-align:center">Hexa Space · 7 Distribution Circuit, Huntingdale VIC 3166 · {{website}}</p>
  </div>
</div></body></html>`
}

const SUMMARY = `<table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:13px">
    <tr><td style="padding:6px 0;color:#888;width:150px">Event</td><td style="padding:6px 0;color:#111">{{eventName}}</td></tr>
    <tr><td style="padding:6px 0;color:#888">Date</td><td style="padding:6px 0;color:#111">{{eventDate}} · {{startTime}}–{{endTime}}</td></tr>
    <tr><td style="padding:6px 0;color:#888">Guests</td><td style="padding:6px 0;color:#111">{{guests}}</td></tr>
    <tr><td style="padding:6px 0;color:#888">Total (inc GST)</td><td style="padding:6px 0;font-weight:700;color:#111">{{total}}</td></tr>
    <tr><td style="padding:6px 0;color:#888">Payable now</td><td style="padding:6px 0;color:#111">{{dueNow}} <span style="color:#888">(50% deposit + $300 security)</span></td></tr>
  </table>`

export const DEFAULT_FUNCTION_BROCHURE_SUBJECT = 'Hexa Space function space — {{eventName}}'
export const DEFAULT_FUNCTION_BROCHURE_HTML = frame(`
  <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Function Space Hire</p>
  <h2 style="font-size:20px;color:#111;margin:0 0 16px">Hi {{name}} — thanks for your interest in our function space</h2>
  <p style="font-size:14px;color:#555;margin:0 0 18px">Our light-filled venue suits launches, dinners, conferences and celebrations. Here's a quick overview:</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px">
    <tr><td style="padding:6px 0;color:#888">Venue hire (weekday)</td><td style="padding:6px 0;text-align:right;color:#111">$250 + GST / hour</td></tr>
    <tr><td style="padding:6px 0;color:#888">Venue hire (weekend)</td><td style="padding:6px 0;text-align:right;color:#111">$325 + GST / hour</td></tr>
    <tr><td style="padding:6px 0;color:#888">Cleaning fee</td><td style="padding:6px 0;text-align:right;color:#111">$200 + GST</td></tr>
    <tr><td style="padding:6px 0;color:#888">Refundable security deposit</td><td style="padding:6px 0;text-align:right;color:#111">$300</td></tr>
    <tr><td style="padding:6px 0;color:#888">Capacity</td><td style="padding:6px 0;text-align:right;color:#111">20–100 guests</td></tr>
  </table>
  <p style="font-size:13px;color:#555;margin:0 0 8px">Ready to lock it in? Just reply to this email and we'll send you a secure link to confirm your details, see your total and pay your deposit.</p>
  <p style="font-size:12px;color:#999;margin:16px 0 0">Questions? Reply any time — we'd love to host you.</p>`)

export const DEFAULT_FUNCTION_AGREEMENT_SUBJECT = 'Your Hexa Space function quote — {{eventName}}'
export const DEFAULT_FUNCTION_AGREEMENT_HTML = frame(`
  <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Function Space Hire Agreement</p>
  <h2 style="font-size:20px;color:#111;margin:0 0 18px">Hi {{name}} — your function quote is ready to review &amp; sign</h2>
  <p style="font-size:14px;color:#555;margin:0 0 20px">Please review your event details, add-ons, pricing and our terms, then sign digitally to secure your date.</p>
  ${SUMMARY}
  <div style="text-align:center;margin:28px 0">
    <a href="{{signLink}}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 36px;font-size:14px;font-weight:700;border-radius:6px">Review &amp; Sign Agreement</a>
  </div>
  <p style="font-size:12px;color:#999;margin:0">If the button doesn't work, copy this link:<br><a href="{{signLink}}" style="color:#888;word-break:break-all">{{signLink}}</a></p>`)

export const DEFAULT_FUNCTION_CONFIRMED_SUBJECT = 'Confirmed — your function at Hexa Space ({{eventDate}})'
export const DEFAULT_FUNCTION_CONFIRMED_HTML = frame(`
  <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">Booking Confirmed</p>
  <h2 style="font-size:20px;color:#111;margin:0 0 18px">You're booked in, {{name}}! 🎉</h2>
  <p style="font-size:14px;color:#555;margin:0 0 20px">Your function at Hexa Space is confirmed. We've reserved your time (plus a 30-minute setup buffer each side). Your deposit and security invoices are on their way; the balance is due 14 days before your event.</p>
  ${SUMMARY}
  <p style="font-size:13px;color:#555;margin:0">Questions? Just reply to this email — we can't wait to host you.</p>`)
