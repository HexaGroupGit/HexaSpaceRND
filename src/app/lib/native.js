import { Capacitor } from '@capacitor/core'

// Native (Capacitor) glue for the member app. On the web all of this is a
// no-op passthrough, so the same code serves portal.hexaspace.com.au/app and
// the store builds.

export const isNative = () => Capacitor.isNativePlatform()

// 'ios' | 'android' | 'web'. On the web build Capacitor reports 'web', so fall
// back to a userAgent sniff to still tailor the phone print instructions.
export function platform() {
  const p = Capacitor.getPlatform()
  if (p !== 'web') return p
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'web'
}

// The on-prem Mobility Print server. Reachable ONLY from the Hexa network:
// every client has this address baked in and there is no public endpoint, which
// is why "failed to retrieve printer list" is nearly always the wrong Wi-Fi
// rather than a broken install.
export const PRINT_SERVER_HOST = '172.16.200.14'
export const PRINT_SERVER_URL = `http://${PRINT_SERVER_HOST}:9163`

// Send laptops to the server's OWN setup pages, not to a file we bundled.
// Mobility Print updates itself, and the Mac client is not even kept on disk
// here - the server generates it on request. On 6 Aug 2026 it served macOS
// 1.0.825 while public/downloads/hexa-printer-mac.dmg was still 1.0.78.
// These pages always hand out the current build, and because the server is
// LAN-only, the page loading at all proves the member is on the right network.
// NOTE: absolute URLs - do NOT pass these through apiUrl(), which prefixes
// relative paths with the portal origin.
export const WINDOWS_PRINT_SETUP = `${PRINT_SERVER_URL}/setup`
export const MAC_PRINT_SETUP = `${PRINT_SERVER_URL}/client-setup/known-host/macos.html`

// Store / profile links for Mobility Print, per platform.
export const ANDROID_PRINT_APP = `https://play.google.com/store/apps/details?id=com.papercut.projectbanksia&referrer=server=${PRINT_SERVER_HOST}`
export const IOS_PRINT_PROFILE = '/downloads/hexa-printer-ios.mobileconfig'
// Bundled fallbacks, served by the portal. Kept for anyone who cannot open the
// setup pages above; refresh them with scripts/papercut-connector/refresh-print-installers.mjs.
export const WINDOWS_PRINT_INSTALLER = '/downloads/hexa-printer-windows.exe'
export const MAC_PRINT_INSTALLER = '/downloads/hexa-printer-mac.dmg'

// The native shell serves bundled assets from https://localhost, so API calls
// must be absolute. On the web, relative paths keep working as before.
export const API_BASE = 'https://portal.hexaspace.com.au'
export const apiUrl = (path) => (isNative() ? `${API_BASE}${path}` : path)

/**
 * Follow a payment URL (Stripe Checkout / card setup). Native: opens a Chrome
 * Custom Tab so the bundled app isn't navigated away; the user returns to the
 * app and a resume refresh picks up the result (webhook writes it server-side).
 * Web: same-tab redirect, exactly as before.
 */
export async function openPayment(url) {
  if (isNative()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } else {
    window.location.href = url
  }
}

/** Run cb when the app returns to the foreground. Returns an unsubscribe. */
export function onAppResume(cb) {
  if (isNative()) {
    let handle = null
    import('@capacitor/app').then(({ App }) =>
      App.addListener('resume', cb).then((h) => { handle = h })
    ).catch(() => {})
    return () => handle?.remove()
  }
  const fn = () => { if (document.visibilityState === 'visible') cb() }
  document.addEventListener('visibilitychange', fn)
  return () => document.removeEventListener('visibilitychange', fn)
}

/** Native chrome: status bar to match the bone ground. */
export async function applyNativeChrome() {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Light }) // light bg, dark icons
    await StatusBar.setBackgroundColor({ color: '#F6F5F1' })
  } catch { /* plugin unavailable (web/dev) */ }
}
