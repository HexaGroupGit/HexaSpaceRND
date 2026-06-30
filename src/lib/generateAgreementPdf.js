import { jsPDF } from 'jspdf'

/**
 * Generate a fully executed agreement PDF for the Lonsdale 369 Pop-up vendor.
 *
 * Structure:
 *   Page 1      — Signing certificate (parties + both signatures)
 *   Pages 2-N   — Full document text:
 *                   · Pop-up Licence Agreement (Schedule + 27 clauses)
 *                   · Liability Waiver and Acknowledgement (9 clauses)
 *                   · Annexure A — Venue Rules (13 rules)
 *                   · Annexure B — Compliance Notes
 *                   · Annexure C — Marketing Requirements
 *
 * @param {object} booking     Vendor booking JSONB
 * @param {object|null} adminSig  { signatureData, signerName, signerTitle }
 * @returns {Blob}
 */
export function generateAgreementPdf(booking, adminSig) {
  // Use per-booking licensor sig if set (from countersign flow)
  const sig = booking.licensorSignatureData
    ? { signatureData: booking.licensorSignatureData, signerName: booking.licensorSignerName, signerTitle: booking.licensorSignerTitle }
    : adminSig

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const M = 18            // left/right margin
  const maxW = W - M * 2
  const pageH = 297
  const footerY = pageH - 10
  let y = 0
  let pageNum = 0

  // ── Page infrastructure ───────────────────────────────────────────────────────

  function newPage(skipHeader = false) {
    if (pageNum > 0) doc.addPage()
    pageNum++
    y = 0
    if (!skipHeader) runningHeader()
  }

  function runningHeader() {
    doc.setFillColor(0, 0, 0)
    doc.rect(0, 0, W, 11, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    doc.text('HEXAHUB', M, 7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(160, 160, 160)
    doc.text('Pop-up Licence · Lonsdale 369', W - M, 7, { align: 'right' })
    doc.setTextColor(200, 200, 200)
    doc.text(`${pageNum}`, W / 2, 7, { align: 'center' })
    y = 18
  }

  function footerLine() {
    doc.setDrawColor(220, 220, 220)
    doc.line(M, footerY - 3, W - M, footerY - 3)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text('HexaHub Pty Ltd · 7 Distribution Circuit, Huntingdale VIC 3166 · hexahub.com.au', W / 2, footerY, { align: 'center' })
  }

  function ensureSpace(needed) {
    if (y + needed > footerY - 10) {
      footerLine()
      newPage()
    }
  }

  // ── Text helpers ──────────────────────────────────────────────────────────────

  const LH = { 7: 3.5, 8: 4, 9: 4.5, 10: 5, 11: 5.5, 12: 6, 14: 7, 16: 8 }

  function text(str, x, sz, { bold = false, italic = false, color = [20, 20, 20], align = 'left' } = {}) {
    doc.setFont('helvetica', bold ? 'bold' : italic ? 'italic' : 'normal')
    doc.setFontSize(sz)
    doc.setTextColor(...color)
    doc.text(str, x, y, { align })
    y += (LH[sz] || 5) * 1.2
  }

  function para(str, { sz = 9, bold = false, italic = false, indent = 0, before = 1.5, after = 2, color = [30, 30, 30] } = {}) {
    const lh = LH[sz] || 4.5
    doc.setFont('helvetica', bold ? 'bold' : italic ? 'italic' : 'normal')
    doc.setFontSize(sz)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(str, maxW - indent)
    ensureSpace(before + lines.length * lh * 1.2 + after + 4)
    y += before
    doc.text(lines, M + indent, y)
    y += lines.length * lh * 1.2 + after
  }

  function heading(str, { sz = 8, upper = true, before = 4, after = 2 } = {}) {
    ensureSpace(before + (LH[sz] || 4) + after + 6)
    y += before
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(sz)
    doc.setTextColor(80, 80, 80)
    doc.text(upper ? str.toUpperCase() : str, M, y)
    y += (LH[sz] || 4) * 1.2 + after
  }

  function rule() {
    ensureSpace(6)
    doc.setDrawColor(210, 210, 210)
    doc.line(M, y, W - M, y)
    y += 5
  }

  function clauseTitle(str) {
    ensureSpace(12)
    y += 3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(20, 20, 20)
    doc.text(str, M, y)
    y += 5.5
  }

  function scheduleRow(label, value) {
    const lh = 4.2
    const valLines = doc.splitTextToSize(String(value ?? '—'), maxW - 52)
    const rowH = Math.max(1, valLines.length) * lh + 3
    ensureSpace(rowH + 2)
    doc.setFillColor(248, 248, 248)
    doc.rect(M, y - 1, 50, rowH, 'F')
    doc.setDrawColor(220, 220, 220)
    doc.rect(M, y - 1, maxW, rowH, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    doc.text(label, M + 2, y + lh * 0.7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(20, 20, 20)
    doc.text(valLines, M + 52, y + lh * 0.7)
    y += rowH
  }

  function docDivider(title) {
    footerLine()
    newPage()
    doc.setFillColor(0, 0, 0)
    doc.rect(M, y, maxW, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(title, W / 2, y + 6.5, { align: 'center' })
    y += 14
  }

  function fmtTime(t) {
    if (!t) return '—'
    const [h, m] = t.split(':').map(Number)
    const ap = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`
  }
  function fmtDate(d) {
    if (!d) return '—'
    try {
      const dt = new Date(d)
      return dt.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    } catch { return d }
  }
  function fmtMoney(v) {
    if (!v && v !== 0) return null
    return `$${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD`
  }

  const b = booking
  const vendorDisplay = [b.vendorBusiness, b.vendorName].filter(Boolean).join(' — ') || b.vendorName || '—'
  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const venueName = b.venue || 'Lonsdale 369'
  const period = b.bookingStartDate && b.bookingEndDate
    ? `${fmtDate(b.bookingStartDate)} – ${fmtDate(b.bookingEndDate)}`
    : (b.eventDate ? fmtDate(b.eventDate) : '—')

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — SIGNING CERTIFICATE
  // ════════════════════════════════════════════════════════════════════════════

  newPage(true)

  // Black header
  doc.setFillColor(0, 0, 0)
  doc.rect(0, 0, W, 16, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text('HEXAHUB', M, 10.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 160)
  doc.text('Signing Certificate', W - M, 10.5, { align: 'right' })
  y = 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(20, 20, 20)
  doc.text('Pop-up Licence Agreement', M, y); y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(`${venueName} · ${period}`, M, y); y += 6
  doc.setFontSize(8.5)
  doc.setTextColor(80, 80, 80)
  doc.text(`Reference: ${b.ref || '—'}`, M, y)
  if (b.signedAt) {
    const sd = new Date(b.signedAt).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    doc.text(`Vendor signed: ${sd}`, W - M, y, { align: 'right' })
  }
  y += 9

  // Divider
  doc.setDrawColor(210, 210, 210); doc.line(M, y, W - M, y); y += 7

  // Parties
  const colL = M, colR = W / 2 + 5
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(140, 140, 140)
  doc.text('LICENSOR', colL, y); doc.text('LICENSEE', colR, y); y += 5
  const sy = y
  const licLines = [['bold','HexaHub Pty Ltd'],['n','7 Distribution Circuit'],['n','Huntingdale VIC 3166'],['n','info@hexahub.com.au']]
  licLines.forEach(([w,t]) => { doc.setFont('helvetica', w==='bold'?'bold':'normal'); doc.setFontSize(9); doc.setTextColor(20,20,20); doc.text(t,colL,y); y+=5 })
  y = sy
  const venLines = [['bold', vendorDisplay], ...(b.vendorAbn?[['n',`ABN: ${b.vendorAbn}`]]:[]), ['n',b.vendorName||'—'], ...(b.vendorEmail?[['n',b.vendorEmail]]:[])]
  venLines.forEach(([w,t]) => { doc.setFont('helvetica', w==='bold'?'bold':'normal'); doc.setFontSize(9); doc.setTextColor(20,20,20); doc.text(t,colR,y); y+=5 })
  y = sy + Math.max(licLines.length, venLines.length) * 5 + 5

  doc.setDrawColor(210,210,210); doc.line(M,y,W-M,y); y+=7

  // Documents agreed
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(140,140,140); doc.text('DOCUMENTS AGREED TO',M,y); y+=6
  const docs = ['Pop-up Licence Agreement','Venue Rules and Operating Conditions']
  docs.forEach(d => { doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(20,20,20); doc.text('✓',M,y); doc.setFont('helvetica','normal'); doc.text(d,M+6,y); y+=5.5 })
  y+=3

  // Event details
  doc.setDrawColor(210,210,210); doc.line(M,y,W-M,y); y+=7
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(140,140,140); doc.text('BOOKING DETAILS',M,y); y+=6
  const evtLines = [b.allocatedSpace?`Space: ${b.allocatedSpace}`:null, `Venue: ${venueName} — 369 Lonsdale Street, Melbourne VIC 3000`, `Booking period: ${period}`, b.bookingDays?`Days: ${b.bookingDays}`:null].filter(Boolean)
  evtLines.forEach(l => { doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(20,20,20); doc.text(l,M,y); y+=5 })
  y+=4

  // Signatures
  doc.setDrawColor(210,210,210); doc.line(M,y,W-M,y); y+=7
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(140,140,140); doc.text('SIGNATURES',M,y); y+=6
  const sigW=72, sigH=22
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(100,100,100)
  doc.text('LICENSEE',colL,y); doc.text('LICENSOR',colR,y); y+=4
  doc.setDrawColor(210,210,210); doc.rect(colL,y,sigW,sigH); doc.rect(colR,y,sigW,sigH)
  if (b.signatureData) { try { doc.addImage(b.signatureData,'PNG',colL+2,y+2,sigW-4,sigH-4) } catch(_){} }
  if (sig?.signatureData) { try { doc.addImage(sig.signatureData,'PNG',colR+2,y+2,sigW-4,sigH-4) } catch(_){} } else { doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(180,180,180); doc.text('To be countersigned',colR+sigW/2,y+sigH/2+2,{align:'center'}) }
  y+=sigH+3
  doc.setDrawColor(60,60,60); doc.line(colL,y,colL+sigW,y); doc.line(colR,y,colR+sigW,y); y+=5
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(20,20,20)
  doc.text(b.signerName||'—',colL,y); doc.text(sig?.signerName||'HexaHub Pty Ltd',colR,y); y+=5
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(80,80,80)
  doc.text(b.signerTitle||'Authorised Representative',colL,y); doc.text(sig?.signerTitle||'Licensor',colR,y); y+=5
  doc.setFontSize(8)
  doc.text(b.signerDate||'—',colL,y)
  if (b.licensorSignedAt) { doc.text(new Date(b.licensorSignedAt).toLocaleDateString('en-AU',{day:'2-digit',month:'short',year:'numeric'}),colR,y) }
  y+=12

  // Footer note
  doc.setDrawColor(210,210,210); doc.line(M,y,W-M,y); y+=5
  doc.setFont('helvetica','italic'); doc.setFontSize(7.5); doc.setTextColor(160,160,160)
  const cert = 'This certificate confirms the above-named Licensee has electronically read and agreed to the Pop-up Licence Agreement and Venue Rules. Full agreement text follows on subsequent pages.'
  doc.text(doc.splitTextToSize(cert, maxW), W/2, y, { align: 'center' })
  footerLine()

  // ════════════════════════════════════════════════════════════════════════════
  // DOCUMENT 1 — EVENT VENUE LICENCE AGREEMENT
  // ════════════════════════════════════════════════════════════════════════════

  docDivider('DOCUMENT 1 — EVENT VENUE LICENCE AGREEMENT')

  // Document header
  para('HexaHub Pty Ltd', { sz: 8, bold: true, color: [100,100,100], before: 0, after: 1 })
  para('Pop-up Licence Agreement', { sz: 14, bold: true, before: 0, after: 2 })
  para(`${venueName} · ${period}`, { sz: 9, color: [100,100,100], before: 0, after: 4 })

  rule()

  // Schedule
  heading('Schedule — Booking Details', { sz: 8, upper: false, before: 4, after: 3 })
  scheduleRow('Licensor', 'HexaHub Pty Ltd (ABN 51 234 567 890)')
  scheduleRow('Licensor Address', '7 Distribution Circuit, Huntingdale VIC 3166')
  scheduleRow('Licensor Contact', 'info@hexahub.com.au')
  scheduleRow('Licensee', vendorDisplay)
  scheduleRow('Licensee Contact', b.vendorName || '—')
  scheduleRow('Licensee Email', b.vendorEmail || '—')
  scheduleRow('Licensee ABN', b.vendorAbn || '—')
  scheduleRow('Venue', b.allocatedSpace ? `${b.allocatedSpace} — 369 Lonsdale Street, Melbourne VIC 3000` : '369 Lonsdale Street, Melbourne VIC 3000')
  scheduleRow('Permitted Use', [b.vendorType, b.vendorDescription].filter(Boolean).join(' — ') || 'Retail / brand pop-up')
  scheduleRow('Booking Period', period)
  scheduleRow('Days Booked', b.bookingDays ? `${b.bookingDays} day${b.bookingDays === 1 ? '' : 's'}` : '—')
  scheduleRow('Daily Rate', fmtMoney(b.dailyRate) || '—')
  scheduleRow('Licence Fee', fmtMoney(b.participationFee) || '—')
  scheduleRow('Bond', fmtMoney(b.bond) || 'Nil')
  scheduleRow('Deposit', fmtMoney(b.deposit) || (b.participationFee ? '50% of Licence Fee payable on signing' : 'Nil'))
  scheduleRow('Balance Due Date', b.balanceDueDate ? fmtDate(b.balanceDueDate) : '7 days before Event Date')
  scheduleRow('Included Services', b.includedServices || 'As directed by Licensor')
  scheduleRow('Excluded Services', b.excludedServices || 'All items not specified as included')
  scheduleRow('Insurance Requirement', 'Min. AUD $20,000,000 Public Liability Insurance per occurrence')
  scheduleRow('Security Required', b.securityRequired ? 'Yes' : 'No')
  scheduleRow('Alcohol Permitted', b.alcoholPermitted ? 'Yes — subject to all required approvals' : 'No')
  scheduleRow('Food Permitted', b.foodPermitted !== false ? 'Yes — subject to all required registrations' : 'No')
  scheduleRow('Special Conditions', b.specialConditions || 'Nil')

  rule()
  para(`This Agreement is entered into on ${today} between the Licensor and Licensee named in the Schedule above.`, { sz: 8, italic: true, color: [100,100,100] })

  heading('Recitals')
  para('A.  The Licensor controls and operates the premises situated at 369 Lonsdale Street, Melbourne VIC 3000.')
  para('B.  The Licensee has requested permission to use part of the Premises for the Event.')
  para('C.  The Licensor has agreed to grant the Licensee a temporary, revocable and non-exclusive licence to use the Venue on the terms of this Agreement.')
  para('D.  The parties acknowledge and agree that this Agreement creates a licence only and does not create a lease, tenancy, retail tenancy, periodic tenancy, exclusive possession or any estate or interest in land.')

  heading('Terms and Conditions')

  clauseTitle('1.  Recitals')
  para('The recitals form part of this Agreement.')

  clauseTitle('2.  Definitions and Interpretation')
  para('In this Agreement, unless the context otherwise requires:')
  para('Additional Charges means all charges payable in addition to the Licence Fee, including cleaning charges, waste disposal charges, security charges, staff charges, overtime charges, repair costs, reinstatement costs, call-out fees, utility surcharges and any other amount payable under this Agreement.', { indent: 5 })
  para('Agreement means this Pop-up Licence Agreement, including the Schedule and any annexures.', { indent: 5 })
  para('Bond means the security deposit specified in the Schedule.', { indent: 5 })
  para('Business Day means a day other than a Saturday, Sunday or public holiday in Victoria.', { indent: 5 })
  para('Event means the event described in the Schedule.', { indent: 5 })
  para('Event Personnel means the Licensee\'s employees, contractors, subcontractors, agents, caterers, performers, suppliers, security personnel, invitees, guests, attendees, volunteers and any other person brought onto the Premises by or on behalf of the Licensee.', { indent: 5 })
  para('Licence Fee means the fee payable for the licence granted under this Agreement, as specified in the Schedule.', { indent: 5 })
  para('Licence Period means the period commencing at the start of the approved access time, including bump-in, and ending when the Licensee has fully vacated the Venue, completed bump-out, removed all property and complied with its reinstatement obligations.', { indent: 5 })
  para('Permitted Use means the use of the Venue approved by the Licensor and stated in the Schedule.', { indent: 5 })
  para('Premises means the land and improvements at 369 Lonsdale Street, Melbourne VIC 3000, including all access points, loading areas, amenities, car parking areas, common areas and external areas made available by the Licensor from time to time.', { indent: 5 })
  para('Venue means the area or areas within the Premises described in the Schedule.', { indent: 5 })
  para('Unless the contrary intention appears, headings are for convenience only, the singular includes the plural and vice versa, legislation includes amendments and subordinate instruments, and including is not a term of limitation.')

  clauseTitle('3.  Grant of Licence')
  para('Subject to this Agreement, the Licensor grants to the Licensee a personal, non-exclusive, non-transferable, revocable licence to use the Venue during the Licence Period solely for the Permitted Use.')
  para('The Licensee acknowledges and agrees that the Licence is temporary only, the Licensor retains possession and control of the Venue and Premises at all times, the Licensee has no right to exclusive possession, and the Licensee acquires no tenancy rights, retail leasing rights or other proprietary rights.')
  para('The Licensor may impose reasonable directions, restrictions and conditions regarding access and circulation, occupancy and crowd control, safety and emergency procedures, bump-in and bump-out, noise and amenity, security arrangements, use of services and equipment, lawful operation of the Premises, and protection of the Venue, neighbouring occupiers and the Licensor\'s reputation.')
  para('The Licensor and its representatives may enter the Venue at any time for operational, safety, emergency, security, compliance, cleaning, maintenance, inspection or repair purposes.')

  clauseTitle('4.  Term')
  para('This Agreement commences on the date it is executed by both parties unless an earlier commencement date is stated in the Schedule.')
  para('The Licensee may access and use the Venue only during the Licence Period and only for the Permitted Use.')
  para('The Licensee must vacate the Venue and the Premises by the expiry of the Licence Period. Holding over is not permitted and may attract overtime and additional charges if allowed by the Licensor.')

  clauseTitle('5.  Fees, Bond and Payment')
  para('The Licensee must pay the Licence Fee, the Bond, all Additional Charges, all other amounts stated in the Schedule and GST on all taxable supplies.')
  para('Unless otherwise stated in the Schedule, a non-refundable deposit of 50% of the Licence Fee is payable on signing, the balance of the Licence Fee is payable no later than 7 days before the Event Date, and the Bond is payable no later than 5 Business Days before the Event Date.')
  para('Time for payment is of the essence. The Licensor is not obliged to provide access to the Venue unless all required monies have been paid in cleared funds.')
  para('The Licensor may apply the Bond toward any amount due under this Agreement, including unpaid fees, cleaning costs, waste removal costs, damage or repair costs, overtime charges, reinstatement costs and costs arising from breach. The Bond does not limit the Licensee\'s liability.')

  clauseTitle('6.  Use of Venue')
  para('The Licensee must use the Venue strictly for the Permitted Use, during the Licence Period only, in accordance with this Agreement, all laws and approvals, and all lawful directions of the Licensor.')
  para('The Licensee must not, and must ensure that Event Personnel do not, use the Venue for any unlawful, dangerous, immoral, offensive or improper purpose; do anything likely to damage the Licensor\'s reputation or goodwill; permit overcrowding; obstruct exits, accessways, driveways, loading areas, emergency services or common areas; cause nuisance, disturbance or unreasonable interference; damage, mark, penetrate, alter or attach anything to the Venue without prior written approval; use naked flames, fireworks, pyrotechnics, smoke machines, hazardous substances or dangerous goods without written consent and approvals; bring onto the Premises any unlawful item, weapon or prohibited substance; use the Venue for residential or overnight accommodation purposes; or do anything that may invalidate or prejudice the Licensor\'s insurance.')
  para('The Licensor may require the immediate cessation of any activity that, in the Licensor\'s reasonable opinion, is unsafe, unlawful, non-compliant or likely to damage the Venue or interfere with the Premises.')

  clauseTitle('7.  No Assignment or Sublicensing')
  para('The Licensee must not assign, transfer, novate, sublicense, share possession of, or otherwise deal with its rights under this Agreement without the Licensor\'s prior written consent. Any purported dealing in breach of this clause is void.')

  clauseTitle('8.  Compliance With Laws and Approvals')
  para('The Licensee is solely responsible, at its own cost, for obtaining and maintaining all licences, permits, approvals, registrations and consents required for the Event and the Permitted Use.')
  para('Without limitation, the Licensee must comply with all legal requirements relating to building and occupancy requirements, places of public entertainment, prescribed temporary structures, liquor licensing, food handling and food registration or notification, public health and sanitation, occupational health and safety, crowd control and security, traffic and parking, electrical safety, noise and amenity, copyright and music licensing, and waste disposal and environmental obligations.')
  para('The Licensee must provide to the Licensor, on request and before access is granted, copies of all permits, plans, certificates and approvals relevant to the Event. The Licensor may refuse access or terminate this Agreement if the Licensor is not satisfied, acting reasonably, that the Event may lawfully and safely proceed.')

  clauseTitle('9.  Insurance')
  para('The Licensee must, at its own cost, effect and maintain public liability insurance for not less than AUD $20,000,000 for any one occurrence, workers compensation insurance as required by law, insurance for all property and equipment brought onto the Premises, any motor vehicle insurance required by law, and any additional insurance reasonably required by the Licensor having regard to the nature of the Event.')
  para('The public liability policy should, where reasonably available, note the interest of the Licensor, extend to the use of the Venue and Premises, and not contain exclusions inconsistent with the nature of the approved Event.')
  para('The Licensee must provide the Licensor with certificates of currency no later than 5 Business Days before the Event Date, or earlier on request. Failure to provide satisfactory evidence of insurance entitles the Licensor to deny access, suspend the booking or terminate this Agreement.')

  clauseTitle('10.  Safety, Risk Management and Venue Protection')
  para('The Licensee must ensure that the Event is planned and conducted in a safe manner. The Licensee must identify and manage foreseeable risks, ensure all Event Personnel are suitably qualified, licensed, trained and supervised, comply with site inductions and emergency procedures, ensure exits and firefighting equipment remain unobstructed, ensure electrical equipment used is safe and compliant, and immediately report incidents, injuries, hazards, complaints and emergencies to the Licensor.')
  para('The Licensor may require the Licensee to provide an event management plan, risk assessment, bump-in and bump-out plan, security plan, traffic management plan, emergency management plan, first aid plan, contractor registers, supplier details and evidence of inductions and safety briefings before the Event.')

  clauseTitle('11.  Contractors, Suppliers and Event Personnel')
  para('The Licensee is responsible for all Event Personnel and must ensure that all contractors and suppliers engaged by it are appropriately qualified, licensed and insured, comply with all applicable laws and site rules, act safely and professionally, and do not interfere with the operation, access or reputation of the Premises.')
  para('The Licensor may refuse access to any contractor, supplier, vehicle, structure or equipment that the Licensor reasonably considers unsafe, unsuitable, unlawful or likely to damage the Venue.')

  clauseTitle('12.  Security and Conduct')
  para('The Licensor may require the Licensee to provide licensed security personnel in numbers and on terms acceptable to the Licensor. The Licensee must ensure orderly conduct of all attendees and must immediately comply with any direction of the Licensor concerning safety, intoxication, conduct, noise, access or crowd management.')
  para('The Licensor may remove, or direct the removal of, any person from the Premises who is intoxicated, disorderly, unsafe, non-compliant or otherwise objectionable.')

  clauseTitle('13.  Food, Beverage and Alcohol')
  para('The Licensee must not sell, supply or permit the service of alcohol unless the Licensor has given prior written consent and all necessary liquor licences, permits and approvals have been obtained and complied with.')
  para('The Licensee must not prepare, handle, store, sell or distribute food or beverages unless all legal requirements are satisfied. The Licensee is responsible for all food safety, liquor compliance, RSA compliance, spill management, waste removal and associated cleaning.')
  para('The Licensor may impose special conditions in relation to alcohol service hours, bar service areas, RSA requirements, catering access, glassware restrictions, smoking and vaping restrictions, and cleaning requirements.')

  clauseTitle('14.  Access, Delivery, Bump-In and Bump-Out')
  para('The Licensee may only access the Venue during the times approved by the Licensor. All deliveries, removals, contractor attendance, setup and dismantling must occur only at approved times and via approved access routes.')
  para('The Licensee must not leave any goods, rubbish, pallets, packaging or equipment in common areas, parking areas, accessways or loading zones. The Licensor may charge overtime, staff or call-out fees where the Licensee exceeds approved access times.')

  clauseTitle('15.  Cleaning, Waste and Reinstatement')
  para('The Licensee must keep the Venue and the Premises clean, safe and orderly throughout the Licence Period.')
  para('By the expiry of the Licence Period, the Licensee must remove all persons, goods, decorations, staging, equipment and rubbish; restore the Venue to the condition existing at the commencement of the Licence Period, fair wear and tear excepted; remove all adhesives, tape, fixings, signage and temporary structures without damage; clean all affected areas; and lawfully remove and dispose of all waste.')
  para('The Licensor may carry out cleaning, removal, disposal, reinstatement or repairs required due to the Event, and the Licensee must pay the cost on demand.')

  clauseTitle('16.  Damage and Repairs')
  para('The Licensee occupies and uses the Venue at its own risk and is liable for all loss of or damage to the Venue, Premises and Licensor\'s property arising from the Event or from the acts or omissions of the Licensee or Event Personnel.')
  para('The Licensor may elect to repair the damage itself, engage others to do so, or require the Licensee to do so under the Licensor\'s supervision. The Licensee must pay the full cost of repair, replacement, make-good and associated losses on demand.')

  clauseTitle('17.  Licensor\'s Property and Services')
  para('Any furniture, fixtures, equipment, services, utilities, internet, AV, lighting, power or other facilities supplied by the Licensor are provided on an as is basis unless expressly agreed otherwise in writing. To the maximum extent permitted by law, the Licensor gives no warranty that any such item or service will be uninterrupted, available, suitable or fit for the Licensee\'s purpose.')
  para('The Licensee must not misuse, overload, tamper with or relocate any Licensor property without consent.')

  clauseTitle('18.  Cancellation by Licensee')
  para('If the Licensee cancels the booking more than 30 days before the Event Date, all deposits paid are forfeited; between 30 and 14 days before the Event Date, 50% of the total contracted charges are payable; and within 14 days of the Event Date, 100% of the total contracted charges are payable.')
  para('The Licensee must also pay all non-recoverable costs incurred by the Licensor in connection with the Event.')

  clauseTitle('19.  Suspension, Refusal of Access and Termination by Licensor')
  para('The Licensor may immediately suspend access, refuse entry, cancel the booking or terminate this Agreement by notice if any amount payable is not paid on time, the Licensee breaches this Agreement, the Licensee fails to provide satisfactory evidence of insurance, permits or plans, the Event is unsafe, unlawful or non-compliant, the Event differs materially from the approved Permitted Use, the conduct of the Licensee or Event Personnel is likely to damage the Venue, interfere with the Premises or adversely affect the Licensor\'s reputation, or the Venue becomes unavailable due to emergency, damage, government order, essential repair or other cause beyond the Licensor\'s reasonable control.')
  para('Where termination arises from the Licensee\'s default, the Licensor may retain all monies paid and recover its Loss. Where the Venue is unavailable for reasons beyond the Licensor\'s reasonable control and without default by the Licensee, the Licensor\'s liability is limited to refunding the Licence Fee actually paid for the affected booking, less any non-recoverable third-party costs reasonably incurred.')

  clauseTitle('20.  Indemnity')
  para('The Licensee indemnifies and must keep indemnified the Licensor and its officers, employees, contractors and agents from and against all Loss arising from or in connection with the Event, the use of the Venue or Premises by the Licensee or Event Personnel, any personal injury, death, loss of property or property damage, any breach of this Agreement, any breach of law, any act or omission of the Licensee or Event Personnel, and any claim by any attendee, contractor, supplier or third party connected with the Event, except to the extent the Loss is caused by the negligence or wilful misconduct of the Licensor.')
  para('This indemnity survives expiry or termination of this Agreement.')

  clauseTitle('21.  Exclusion and Limitation of Liability')
  para('To the maximum extent permitted by law, the Licensor excludes all implied terms, conditions, warranties and guarantees.')
  para('The Licensor is not liable for loss, theft or damage to any property of the Licensee or any other person, interruption or failure of utilities, services or equipment, cancellation, disruption or reduced enjoyment of the Event, or any loss of profit, loss of revenue, loss of opportunity, loss of goodwill or consequential loss. Where liability cannot be excluded, it is limited to the maximum extent permitted by law.')

  clauseTitle('22.  Force Majeure')
  para('Neither party is liable for delay or failure to perform caused by events beyond its reasonable control, including fire, flood, storm, pandemic, government order, utility failure, industrial action, civil disturbance or emergency. In such circumstances, the Licensor may cancel, reschedule or suspend the booking, or apply monies paid to a rescheduled date, acting reasonably.')

  clauseTitle('23.  Privacy, Photography and Recording')
  para('The Licensee is responsible for obtaining all consents required for photography, filming, livestreaming, recording and collection or use of personal information in connection with the Event. The Licensor may operate CCTV and security monitoring systems at the Premises for lawful operational and security purposes.')

  clauseTitle('24.  Default Interest and Recovery Costs')
  para('Interest accrues on overdue amounts at the rate of 10% per annum, calculated daily from the due date until payment. The Licensee must pay all reasonable costs incurred by the Licensor in enforcing this Agreement or recovering any debt, including legal costs on a full indemnity basis.')

  clauseTitle('25.  Notices')
  para('A notice under this Agreement must be in writing and sent by hand, prepaid post or email to the recipient\'s address stated in this Agreement or as later notified. A notice is deemed received if delivered by hand when delivered, if posted in Australia on the second Business Day after posting, and if sent by email when transmitted unless the sender receives an error notice, provided that an email sent after 5.00 pm is deemed received on the next Business Day.')

  clauseTitle('26.  GST')
  para('Unless otherwise stated, all amounts payable under this Agreement are exclusive of GST. If GST is payable on a taxable supply under this Agreement, the recipient must pay the GST in addition to the consideration otherwise payable.')

  clauseTitle('27.  General')
  para('This Agreement constitutes the entire agreement between the parties in relation to its subject matter. No variation is effective unless in writing signed by both parties. A waiver is not effective unless in writing. A failure or delay in exercising a right does not constitute a waiver. Any invalid provision must be read down or severed to the extent necessary without affecting the remainder.')
  para('This Agreement may be executed in counterparts and by electronic signature. This Agreement is governed by the laws of Victoria, Australia, and the parties submit to the exclusive jurisdiction of the courts of Victoria.')

  // Pop-up licence = Licence Agreement + Venue Rules only. The Liability Waiver
  // and Annexures B & C are omitted (kept in source, guarded off).
  const POPUP_OMIT = true
  if (!POPUP_OMIT) {
  docDivider('DOCUMENT 2 — LIABILITY WAIVER AND ACKNOWLEDGEMENT')

  para('HexaHub Pty Ltd', { sz: 8, bold: true, color: [100,100,100], before: 0, after: 1 })
  para('Vendor Liability Waiver and Acknowledgement', { sz: 14, bold: true, before: 0, after: 2 })
  para('Lonsdale 369 Pop-up · Sunday 7 June 2026 · 369 Lonsdale Street, Melbourne VIC 3000', { sz: 9, color: [100,100,100], before: 0, after: 4 })
  para(`This Waiver is given by the Vendor named below in favour of HexaHub Pty Ltd ABN 51 234 567 890 (HexaHub) and is to be read together with and forms part of the Pop-up Licence Agreement between the parties dated ${today}.`, { sz: 8, italic: true, color: [100,100,100] })

  clauseTitle('1.  Defined Terms')
  para('Words defined in the Pop-up Licence Agreement have the same meaning in this Waiver. Vendor means the Licensee named in the Agreement. Vendor Personnel means the Vendor\'s employees, contractors, agents, representatives and any person operating at or from the Vendor\'s stall or space.')

  clauseTitle('2.  Acknowledgement of Risk')
  para('The Vendor acknowledges and agrees that:')
  para('(a) participation in the Event as a vendor, stallholder or exhibitor involves inherent risks, including but not limited to personal injury, property damage, theft, financial loss and disruption;', { indent: 5 })
  para('(b) HexaHub makes no representation or warranty that the Venue or Premises is suitable for the Vendor\'s specific purposes or that the Event will attract any particular number of attendees;', { indent: 5 })
  para('(c) the Vendor has independently assessed the suitability of the Venue and the risks associated with its participation and is satisfied that it is appropriate to proceed on the terms of this Waiver and the Agreement; and', { indent: 5 })
  para('(d) HexaHub does not guarantee exclusivity for the Vendor\'s product or service category at the Event.', { indent: 5 })

  clauseTitle('3.  Waiver and Release')
  para('To the fullest extent permitted by law, the Vendor, for itself and on behalf of all Vendor Personnel, releases, waives, discharges and covenants not to sue HexaHub, its officers, directors, employees, contractors and agents (Released Parties) from and against any and all claims, demands, causes of action, losses, costs, damages and liabilities of any kind, whether known or unknown, arising directly or indirectly from or in connection with:')
  para('(a) the Vendor\'s or any Vendor Personnel\'s presence at, participation in or preparation for the Event;', { indent: 5 })
  para('(b) any personal injury, illness or death suffered by the Vendor or any Vendor Personnel at or in connection with the Event;', { indent: 5 })
  para('(c) any loss of or damage to the Vendor\'s goods, stock, cash, equipment, vehicles, display materials or other property, howsoever caused, including loss or damage caused by theft, other vendors, attendees or third parties;', { indent: 5 })
  para('(d) any loss of revenue, loss of sales, loss of profit or other financial loss arising from the Vendor\'s participation in the Event, including reduced attendance or cancellation; and', { indent: 5 })
  para('(e) any act or omission of any other vendor, exhibitor, attendee, contractor or third party at or in connection with the Event.', { indent: 5 })

  clauseTitle('4.  Vendor\'s Responsibility for Attendees and Customers')
  para('The Vendor accepts full responsibility for the safety and conduct of all persons who visit, interact with or purchase from the Vendor\'s stall or space during the Event, including responsibility for:')
  para('(a) ensuring its stall and display items are stable, safe and do not pose a hazard to attendees;', { indent: 5 })
  para('(b) any injury or damage caused to an attendee or customer arising from the Vendor\'s goods, products, samples, displays or operations; and', { indent: 5 })
  para('(c) any claim by an attendee or customer arising out of the Vendor\'s goods or services, including any product liability, food safety or consumer law claim.', { indent: 5 })

  clauseTitle('5.  Indemnity')
  para('In addition to and without limiting clause 20 of the Pop-up Licence Agreement, the Vendor indemnifies and keeps indemnified the Released Parties from and against all Loss arising from or in connection with:')
  para('(a) the Vendor\'s participation in the Event and use of the Venue;', { indent: 5 })
  para('(b) any claim by a Vendor customer or attendee arising from the Vendor\'s goods, services or operations;', { indent: 5 })
  para('(c) any food safety incident, product defect, or personal injury caused by the Vendor\'s goods or operations;', { indent: 5 })
  para('(d) any breach by the Vendor of this Waiver or the Agreement; and', { indent: 5 })
  para('(e) any non-compliance by the Vendor with applicable laws, including food registration, liquor licensing, electrical safety and occupational health and safety requirements.', { indent: 5 })
  para('This indemnity survives expiry or termination of the Agreement.')

  clauseTitle('6.  Insurance Confirmation')
  para('The Vendor warrants that it holds, and will maintain in force through the Event Date, public liability insurance of at least AUD $20,000,000 per occurrence, together with workers compensation insurance as required by law and any other insurance reasonably required having regard to the nature of the Vendor\'s operations. The Vendor acknowledges that it is required to provide a current Certificate of Currency to HexaHub no later than 5 Business Days before the Event Date and that failure to do so entitles HexaHub to refuse access to the Venue.')

  clauseTitle('7.  Food and Beverage Vendors')
  para('Where the Vendor\'s goods or services include food or beverage, the Vendor additionally warrants that all food handlers hold current food safety qualifications, the Vendor holds all required food business registrations or notifications, all food is handled, stored and served in compliance with the Food Act 1984 (Vic) and applicable food standards, and the Vendor will immediately cease food service if directed by HexaHub or a relevant authority.')

  clauseTitle('8.  Preservation of Statutory Rights')
  para('Nothing in this Waiver excludes, restricts or modifies any right, remedy or guarantee that the Vendor may have under the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) or any other applicable legislation that cannot by law be excluded, restricted or modified. To the extent that such rights apply, nothing in this Waiver affects those rights.')

  clauseTitle('9.  Severability and Governing Law')
  para('If any provision of this Waiver is held to be void, invalid or unenforceable, that provision must be read down to the minimum extent necessary or severed, and the remaining provisions continue in full force. This Waiver is governed by the laws of Victoria, Australia.')

  para('By signing the Pop-up Licence Agreement, the Vendor confirms that it has read, understood and agreed to this Liability Waiver and Acknowledgement on behalf of itself and all Vendor Personnel.', { sz: 8, italic: true, color: [100,100,100], before: 6 })
  } // end omitted Liability Waiver

  // ════════════════════════════════════════════════════════════════════════════
  // ANNEXURE A — VENUE RULES
  // ════════════════════════════════════════════════════════════════════════════

  docDivider('ANNEXURE A — VENUE RULES AND OPERATING CONDITIONS')

  para('HexaHub Pty Ltd', { sz: 8, bold: true, color: [100,100,100], before: 0, after: 1 })
  para('Annexure A — Venue Rules and Operating Conditions', { sz: 13, bold: true, before: 0, after: 1 })
  para('369 Lonsdale Street, Melbourne VIC 3000', { sz: 9, color: [100,100,100], before: 0, after: 4 })
  para('These Venue Rules are incorporated into the Agreement. In the event of any inconsistency, the Licensor may direct the stricter requirement to apply to the extent permitted by law.', { sz: 8, italic: true, color: [100,100,100] })

  const rules = [
    'Only the approved areas of the Premises may be used. Any use of loading areas, parking areas, common areas or back-of-house areas requires prior approval.',
    'The Licensee must comply with all bump-in and bump-out windows and all directions regarding vehicle movements, deliveries and collections.',
    'No nails, screws, hooks, glue, tape, paint, fixings or penetrations may be used on any surface without written approval. Any approved fixing must be removed and made good at the Licensee\'s cost.',
    'All exits, fire doors, fire extinguishers, hose reels, hydrants, switchboards and emergency access paths must remain clear at all times.',
    'No unlawful activity is permitted. No dangerous goods, prohibited substances or weapons may be brought onto the Premises.',
    'Smoking and vaping are prohibited except in any area specifically designated by the Licensor and legally permitted for that purpose.',
    'Alcohol may only be supplied if expressly approved in writing by the Licensor and all required liquor approvals are in place.',
    'Food preparation, catering, food trucks, stalls and mobile food operations require prior written approval and compliance with all applicable registration or notification requirements.',
    'All electrical equipment brought onto the Premises must be safe, suitable and legally compliant. The Licensor may require test and tag evidence where appropriate.',
    'The Licensee must ensure that guests leave the Premises in an orderly manner and without causing nuisance or disturbance to neighbouring occupiers or surrounding properties.',
    'The Licensee must remove all rubbish, decorations, packaging, pallets, stock and temporary items by the end of the Licence Period unless otherwise agreed in writing.',
    'Any cleaning, waste removal, odour treatment, stain treatment, pest treatment, repair or reinstatement required due to the Event may be charged to the Licensee.',
    'The Licensor may vary access arrangements, close off areas, give operational directions, require additional security or direct cessation of any activity where reasonably necessary for safety, compliance or protection of the Venue.',
  ]
  rules.forEach((r, i) => para(`${i + 1}.  ${r}`))

  // Annexures B & C omitted from the pop-up licence (guarded off).
  if (!POPUP_OMIT) {
  docDivider('ANNEXURE B — PRACTICAL VICTORIAN COMPLIANCE NOTES')

  para('HexaHub Pty Ltd', { sz: 8, bold: true, color: [100,100,100], before: 0, after: 1 })
  para('Annexure B — Practical Victorian Compliance Notes', { sz: 13, bold: true, before: 0, after: 4 })
  para('This annexure is intended as a practical licensor checklist and pre-event compliance guide. It is not a substitute for project-specific legal, building, council, liquor, health or safety advice.', { sz: 8, italic: true, color: [100,100,100] })

  const compItems = [
    ['Liquor licensing', 'If alcohol will be sold, supplied, served or included in ticketing, packages or other consideration, the organiser should confirm whether a liquor licence or permit is required and provide the relevant approval before the event. No alcohol service should occur without prior written licensor approval and lawful authority.'],
    ['Food businesses and caterers', 'If food will be handled, sold or distributed, the organiser should ensure that each caterer, stallholder, food truck or mobile operator is properly registered or notified where required and can provide evidence before bump-in.'],
    ['Occupational health and safety', 'The organiser should prepare a risk assessment and event management plan proportionate to the event profile. Larger or more complex events should also have contractor controls, emergency management, first aid, security and traffic management arrangements.'],
    ['Public liability insurance', 'A public liability limit of at least AUD $20,000,000 is recommended as the minimum contractual requirement for venue use, together with workers compensation and any event-specific insurance reasonably required by the licensor.'],
    ['Places of public entertainment and temporary structures', 'Where the event may amount to public entertainment or involve prescribed temporary structures, building or council advice should be obtained early. Temporary stages, marquees, seating stands and similar installations may trigger approval requirements depending on the structure, area and use case.'],
    ['First aid and emergency response', 'The organiser should assess first aid needs having regard to event size, duration, alcohol service, age profile and risk factors. For larger events, the licensor should request details of the first aid provider, emergency contacts and escalation pathways.'],
    ['Smoking and vaping', 'The organiser must comply with Victorian smoke-free and vape-free restrictions and any stricter licensor rule applying to the site. As a practical control, smoking and vaping should be prohibited except in any designated area approved by the licensor and legally permitted.'],
  ]
  compItems.forEach(([title, body]) => {
    ensureSpace(20)
    y += 2
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(20, 20, 20)
    doc.text(`${title}:`, M, y); y += 5
    para(body, { indent: 0, before: 0 })
  })

  heading('Pre-Event Document Checklist', { sz: 8, upper: false, before: 5, after: 3 })
  const checklist = ['full legal name and ABN / ACN of organiser','event description and anticipated attendee numbers','certificate of currency for public liability insurance','liquor approval or confirmation that no liquor approval is required','food registration or notification evidence for caterers or food vendors','event management plan and risk assessment','contractor and supplier register','security plan and first aid plan where applicable','details of any temporary structures, staging, marquees or amplified sound','building or council advice where public entertainment or temporary structure issues may arise','waste, cleaning and bump-out plan','confirmation that all fees and bond have been paid in cleared funds']
  checklist.forEach(item => { ensureSpace(7); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(20,20,20); doc.text(`•  ${item}`, M + 3, y); y += 5 })

  para('Reference sources for practical compliance review: Victorian Government liquor licensing guidance; Victorian Department of Health food safety and first aid guidance; WorkSafe Victoria event organiser guidance; and Victorian Building Authority guidance on places of public entertainment and prescribed temporary structures.', { sz: 8, italic: true, color: [120,120,120], before: 6 })

  // Annexure C
  docDivider('ANNEXURE C — EVENT, VENUE PROMOTION AND DIGITAL MARKETING REQUIREMENTS')

  para('HexaHub Pty Ltd', { sz: 8, bold: true, color: [100,100,100], before: 0, after: 1 })
  para('Annexure C — Event, Venue Promotion and Digital Marketing Requirements', { sz: 13, bold: true, before: 0, after: 4 })
  para('This annexure forms part of the Agreement. The Licensee must comply with these venue promotion requirements unless the Licensor otherwise agrees in writing.', { sz: 8, italic: true, color: [100,100,100] })

  clauseTitle('1.  Mandatory Promotion Obligation')
  para('The Licensee must actively promote the Licensor, Event and the Venue, as directed by the Licensor from time to time, in connection with the Event and any related publicity, campaign, invitation, listing, registration page, attendee communication or post-event material.')

  clauseTitle('2.  Required Promotion Channels')
  para('Without limiting the Licensee\'s obligations, the Licensee must, where reasonably applicable to the Event and to the Licensee\'s available channels, promote the Licensor, Event and the Venue through one or more of the following:')
  para('•  all social media accounts operated or controlled by the Licensee, including Instagram, Facebook, LinkedIn, Xiaohongshu, WeChat, TikTok, X and any equivalent platform;', { indent: 5 })
  para('•  the Licensee\'s website, landing pages, event registration pages, ticketing pages and event microsites;', { indent: 5 })
  para('•  electronic direct mail, newsletters, SMS campaigns and attendee or member communications;', { indent: 5 })
  para('•  online listings, directory entries, calendar notices, digital advertisements and sponsored content;', { indent: 5 })
  para('•  media releases, blog posts, digital brochures and other online promotional materials; and', { indent: 5 })
  para('•  any other online, digital or social promotion channel reasonably required by the Licensor having regard to the nature and profile of the Event.', { indent: 5 })

  clauseTitle('3.  Form of Promotion')
  para('The Licensee must ensure that all promotional material relating to the Event includes, if required by the Licensor:')
  para('•  the approved name of the Venue and its location at 369 Lonsdale Street, Melbourne VIC 3000;', { indent: 5 })
  para('•  any venue branding, logo, tag, handle, hashtag, hyperlink, booking contact or descriptive wording specified by the Licensor;', { indent: 5 })
  para('•  any credit line, acknowledgement, venue partner reference or promotional message required by the Licensor;', { indent: 5 })
  para('•  any approved venue imagery, photographs, video, map, website link or brand assets supplied or nominated by the Licensor; and', { indent: 5 })
  para('•  any mandatory venue rules, access instructions or special conditions that the Licensor directs to be communicated to attendees online.', { indent: 5 })

  clauseTitle('4.  Minimum Content and Timing')
  para('The Licensor may specify minimum promotional requirements, including the number of posts, publication dates, campaign timing, visibility period, platform mix, wording, tags, links and prominence. The Licensee must comply with those requirements within the timeframes directed by the Licensor.')

  clauseTitle('5.  Approval Rights')
  para('The Licensee must submit promotional copy, artwork, advertisements, listings, captions and digital content referring to the Venue to the Licensor for review if requested by the Licensor. The Licensee must not publish or distribute any material that uses the Venue name, images or branding in a misleading, inaccurate, defamatory, unlawful or reputationally damaging manner.')

  clauseTitle('6.  Branding and Intellectual Property')
  para('The Licensor grants the Licensee a limited, non-exclusive, revocable licence during the Licence Period to use approved Venue names, logos, handles, hashtags, photographs and promotional assets solely for authorised Event promotion. All intellectual property rights in those materials remain with the Licensor. The Licensee must immediately cease use of those materials on request by the Licensor.')

  clauseTitle('7.  Accuracy and Compliance')
  para('The Licensee must ensure that all promotional content relating to the Venue and Event is accurate, current, lawful and compliant with all applicable laws, platform requirements and advertising standards. The Licensee must promptly correct or remove any material if directed by the Licensor.')

  clauseTitle('8.  Cross-Promotion and Venue Content')
  para('If requested by the Licensor, the Licensee must provide the Licensor, without additional charge, with reasonable access to approved event descriptions, logos, still images, promotional artwork and other non-confidential materials so that the Licensor may promote the Event and the Venue on its own channels.')

  clauseTitle('9.  Evidence of Compliance')
  para('Upon request, the Licensee must provide evidence of compliance with this annexure, including copies or screenshots of posts, links to published material, campaign schedules, registration pages and other reasonable proof of publication.')

  clauseTitle('10.  Removal and Post-Event Retention')
  para('The Licensor may require the Licensee to remove, amend or archive promotional content after the Event. Unless otherwise directed, the Licensee must keep at least one reasonable online reference to the Venue\'s involvement or hosting role live for not less than 30 days after the Event where such retention is within the Licensee\'s control.')

  clauseTitle('11.  Costs')
  para('Except to the extent otherwise expressly agreed in writing, the Licensee is responsible for all costs of complying with this annexure, including design, media spend, posting, advertising, content creation and distribution costs.')

  clauseTitle('12.  Breach')
  para('Compliance with this annexure is a material obligation of the Licensee. Failure to comply constitutes a breach of the Agreement and entitles the Licensor to require immediate rectification, withhold approvals, refuse future bookings, recover resulting Loss and exercise any other right available under the Agreement.')
  } // end omitted Annexures B & C

  footerLine()

  return doc.output('blob')
}
