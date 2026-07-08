// Virtual Office membership inclusions — printed on the Virtual Office
// Membership Agreement (screen/e-sign template + PDF export).
export const VO_INCLUSIONS = [
  'Premium Business Address in Box Hill (Level 4/830 Whitehorse Road Box Hill VIC 3128)',
  'Mail & Package Handling',
  'Access to Reception Services',
  'Booking access to meeting rooms, event spaces and media studios with member’s discount (Refer to Meeting Room Pricing Guide)',
  'Daily Access to Sky & Tian Meeting Room + Consulting Rooms (2 Hours Daily)',
  'Coworking lounge access with Enterprise-Grade WiFi. 9:00AM - 5:30PM',
  'Connection to the Ucommune network across China, Singapore and Hong Kong',
  'Exclusive invitations to community events',
  'Complimentary Tea & Coffee',
]

export const isVirtualOfficeAgreement = (lease, space) =>
  /virtual office/i.test(String(lease?.documentType ?? '')) || space?.type === 'virtual'
