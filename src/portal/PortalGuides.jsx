import { Printer, CalendarClock, Receipt, Wifi, KeyRound, Coffee, Laptop, Smartphone, Download, ExternalLink, ArrowRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Page, PageHeader, Card, Eyebrow } from './ui.jsx'

// No OS detection here on purpose — the print server's /setup page reads the
// user-agent and serves the matching installer, so guessing ourselves could only
// disagree with it (e.g. a member reading this on their phone while setting up
// a laptop).

// The on-prem Mobility Print server. Reachable ONLY from the Hexa network —
// every client has this address baked in and there is no public endpoint, which
// is why "failed to retrieve printer list" is nearly always a Wi-Fi problem
// rather than a broken install. Defined once: the Android app link below passes
// the same host as its setup referrer.
const PRINT_SERVER_HOST = '172.16.200.14'
const PRINT_SERVER_URL = `http://${PRINT_SERVER_HOST}:9163`
// ONE link for every device. /setup reads the browser's user-agent and serves
// the matching page - verified 6 Aug 2026 against Windows, macOS, iOS and
// Android agents. So we do NOT detect the OS ourselves: the server does it, and
// our guess can only add a way to get it wrong.
//
// It also always hands out the CURRENT build. The macOS client is not stored on
// the server's disk at all - it is generated on request - so any copy we bundle
// goes stale silently (the server was serving 1.0.825 while ours was 1.0.78).
const PRINT_SETUP_URL = `${PRINT_SERVER_URL}/setup`

const GUIDES = [
  { icon: CalendarClock, title: 'Book a meeting room', body: 'Browse rooms under Meeting Rooms and book your time — it confirms instantly, and door access activates 15 minutes before you start.' },
  { icon: Receipt, title: 'View & download invoices', body: 'Every invoice lives under Billing → Invoices. Download a PDF any time, and check your next bill under Membership.' },
  { icon: KeyRound, title: '24/7 access', body: 'Your access pass works around the clock. Lost your pass? Submit a ticket and reception will reissue one.' },
  { icon: Wifi, title: 'Wi-Fi & printing', body: 'WIFI_BODY_PLACEHOLDER' },
  { icon: Coffee, title: 'Lounge & amenities', body: 'Barista-style coffee, filtered water and end-of-trip facilities are included with every membership.' },
]

export default function PortalGuides({ member }) {
  // Live Wi-Fi credentials from the public settings subset.
  const [wifi, setWifi] = useState({})
  useEffect(() => {
    fetch('/api/portal/settings').then((r) => r.json())
      .then((d) => setWifi(d?.settings?.wifi ?? {})).catch(() => {})
  }, [])
  const guideBody = (g) => g.body === 'WIFI_BODY_PLACEHOLDER'
    ? (wifi.password
        ? <>Network <strong className="text-ink">{wifi.ssid || 'Hexa Spaces'}</strong> · password <span className="font-mono text-ink text-[13px]">{wifi.password}</span>. Set up printing on any device below.</>
        : <>Connect to “{wifi.ssid || 'Hexa Spaces'}” — password at reception. Set up printing on any device below.</>)
    : g.body

  return (
    <Page>
      <PageHeader kicker="Help · Box Hill" title="How-To Guides">
        Everything you need to get the most from Hexa Space. 402/830 Whitehorse Road, Box Hill VIC 3128.
      </PageHeader>

      <div className="grid gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-3 mb-12">
        {GUIDES.map((g, i) => (
          <Card key={i} className="p-7">
            <g.icon size={20} strokeWidth={1.4} className="text-hexa-green" />
            <h3 className="font-heading uppercase tracking-nav text-[12px] mt-5">{g.title}</h3>
            <p className="hx-prose text-[14px] mt-2">{guideBody(g)}</p>
          </Card>
        ))}
      </div>

      <Eyebrow className="mb-4">Printer Setup</Eyebrow>
      {/* PIN, balance and job history live on the dedicated Printing tab. */}
      <Link to="/printing" className="bg-charcoal text-paper px-6 py-5 flex items-center justify-between gap-4 hover:bg-ink transition-colors">
        <div>
          <span className="block font-heading uppercase tracking-label text-[11px] text-paper/50">Your print account</span>
          <span className="block hx-prose text-[13px] text-paper/80 mt-1">Your print PIN, printing balance and job history are on the Printing tab.</span>
        </div>
        <ArrowRight size={16} className="text-hexa-green shrink-0" />
      </Link>

      <div className="grid gap-px bg-ink/10 mt-4">
        {/* Laptop / desktop — lead with the installer for the OS we detect */}
        <MethodCard icon={Laptop} title="Print from your laptop" subtitle="Windows &amp; Mac · “Hexa-Secure” printers">
          {/* Lead with the print server's OWN download page, not the bundled
              copies below. Two reasons. It always serves the current build —
              Mobility Print updates itself, so a file we bundled months ago
              drifts out of date. And because the server is only reachable from
              the Hexa network, the page loading at all PROVES the member is on
              the right Wi-Fi. If it does not load, no installer will help them:
              the printers live on this network and the client has our server's
              address baked in, which is exactly the "failed to retrieve printer
              list" case. Better to find that out before they install anything. */}
          <a href={PRINT_SETUP_URL} target="_blank" rel="noreferrer" className="hx-btn inline-flex items-center gap-2 mb-3">
            <ExternalLink size={13} /> Set up printing on this device
          </a>
          <p className="hx-prose text-[13px] mb-5">
            Works on Windows, Mac, iPhone, iPad and Android — the page gives you the right installer for
            whatever you’re on. <strong>If it doesn’t load, you’re not on the Hexa Wi-Fi</strong> — switch
            network and try again rather than reinstalling.
          </p>
          <Steps items={[
            'Connect to the “Hexa Spaces” Wi-Fi network — printing only works on it.',
            'Open the setup page above and run the installer it offers.',
            'The “Hexa-Secure” printer is added automatically — print to it like any other printer.',
            'The first time you print, sign in with your Hexa Space email and password (just once).',
            'Release your job at any printer by keying in your ID (print PIN) on the keypad.',
          ]} />
          <p className="hx-prose text-[13px] mt-4">
            <strong>“Failed to retrieve printer list”?</strong> That means your laptop can’t reach the print
            server — almost always the wrong Wi-Fi or a guest network. Open {PRINT_SERVER_URL} in a browser:
            if it doesn’t load, that’s the problem, and reinstalling won’t fix it.
          </p>
        </MethodCard>

        {/* Phone / tablet */}
        <MethodCard icon={Smartphone} title="Print from your phone or tablet" subtitle="iPhone, iPad & Android · “Hexa-Secure” printers">
          <p className="hx-eyebrow mb-2">iPhone &amp; iPad</p>
          <a href="/downloads/hexa-printer-ios.mobileconfig" download className="hx-btn inline-flex items-center gap-2 mb-4"><Download size={13} /> iPhone / iPad printer profile</a>
          <Steps items={[
            'On your iPhone/iPad, download and install the printer profile above (Settings will ask you to confirm).',
            'On the “Hexa Spaces” Wi-Fi, open a document → Share → Print → choose “Hexa-Secure”.',
            'First time only: enter your Hexa Space email and password.',
            'Release at any printer by keying in your ID (print PIN).',
          ]} />
          <p className="hx-eyebrow mb-2 mt-6">Android</p>
          <a href={`https://play.google.com/store/apps/details?id=com.papercut.projectbanksia&referrer=server=${PRINT_SERVER_HOST}`} target="_blank" rel="noreferrer" className="hx-btn inline-flex items-center gap-2 mb-4"><ExternalLink size={13} /> Get the Android print app</a>
          <Steps items={[
            'Install the app above (it comes pre-set to our print server), then connect to the “Hexa Spaces” Wi-Fi.',
            'Print as usual and pick the “Hexa-Secure” printer.',
            'Tap the sign-in prompt and enter your Hexa Space email and password.',
            'Release at any printer by keying in your ID (print PIN).',
          ]} />
        </MethodCard>

        {/* Level 2 — uniFlow */}
        <MethodCard icon={Printer} title="Level 2 printers (Canon / uniFlow)" subtitle="A separate system with its own PIN, emailed to you">
          <p className="hx-prose text-[13px] mb-5">The Level 2 Canon printers use uniFlow Online, which issues you a separate printing PIN by email.</p>
          <p className="hx-eyebrow mb-2">1 · Register your account</p>
          <Steps items={[
            <>Visit the <a className="text-hexa-green break-words" href="https://hexa-space.au.uniflowonline.com/public/signup/user/PAXZ272ONN5S" target="_blank" rel="noreferrer">uniFlow sign-up page</a> (or scan the QR code at the printer).</>,
            'Enter your name and email, accept the Terms & Conditions, and click Continue.',
            'Enter the authorisation code emailed to you, then click Login.',
            'You’ll be emailed your personal uniFlow printing PIN.',
          ]} />
          <p className="hx-eyebrow mb-2 mt-6">2 · Install the driver</p>
          <Steps items={[
            'In the uniFlow portal, open the Start Printing tab and click Download driver (Mac or Windows).',
            'Run the installer, then open “uniFlow SmartClient”, enter your email, and click Continue → Start.',
            'A Secure Print Queue is added — print to it, then release at the Level 2 printer with your uniFlow PIN.',
          ]} />
        </MethodCard>
      </div>

      <p className="hx-prose text-[13px] mt-6">
        Trouble printing? Submit a ticket under Account → Tickets and our team will help.
      </p>
    </Page>
  )
}

function MethodCard({ icon: Icon, title, subtitle, children }) {
  return (
    <Card className="p-8 grid md:grid-cols-[auto_1fr] gap-7 items-start">
      <div className="bg-charcoal text-paper h-14 w-14 flex items-center justify-center shrink-0">
        <Icon size={22} strokeWidth={1.3} />
      </div>
      <div className="min-w-0">
        <h3 className="hx-display text-xl">{title}</h3>
        {subtitle && <p className="hx-eyebrow mt-1">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </Card>
  )
}

function Steps({ items }) {
  return (
    <ol className="space-y-3">
      {items.map((step, i) => (
        <li key={i} className="flex gap-4">
          <span className="font-heading text-hexa-green text-[12px] tracking-label mt-0.5 shrink-0">0{i + 1}</span>
          <span className="hx-prose text-[14px]">{step}</span>
        </li>
      ))}
    </ol>
  )
}

