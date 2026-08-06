// Refresh the portal's bundled Mobility Print installers from the print server.
//
// WHY THIS IS NEEDED: Mobility Print updates itself, so the copies under
// public/downloads silently go stale and a member eventually installs a client
// months behind the server. Measured 6 Aug 2026: the bundled macOS client was
// 1.0.78 while the server was handing out 1.0.825.
//
// It pulls from the SERVER's own download endpoints - the exact files its setup
// pages give members - not from the install directory. The install directory is
// not the source of truth: the macOS client is never stored there, the server
// produces it on request, so "newest .dmg on disk" is a stale answer. The
// directory also still holds a build for a DIFFERENT server address
// (…[172.16.220.44].exe, a 2023 leftover) which would point members at a
// machine that no longer exists; this reports those rather than shipping them.
//
// The portal and admin portal both link members to the server's setup pages
// first, which are always current and double as a network test. These bundled
// copies are only the fallback - but a stale fallback is worse than none.
//
// RUN ANYWHERE THAT CAN REACH THE PRINT SERVER, from the REPO ROOT.
//
// PowerShell (what this box actually uses - there is no inline VAR=1 prefix,
// and remember to clear the flag afterwards or a later "dry run" will write):
//   cd C:\Users\61406\HexaSpaceRND
//   node scripts\papercut-connector\refresh-print-installers.mjs
//   $env:PRINT_INSTALLER_APPLY = '1'
//   node scripts\papercut-connector\refresh-print-installers.mjs
//   $env:PRINT_INSTALLER_APPLY = ''
//
// bash / git-bash:
//   node scripts/papercut-connector/refresh-print-installers.mjs
//   PRINT_INSTALLER_APPLY=1 node scripts/papercut-connector/refresh-print-installers.mjs
//
// Then commit whatever changed under public/downloads and redeploy the portal.

import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const MP_DIR = process.env.MOBILITY_PRINT_DIR || 'C:\\Program Files (x86)\\PaperCut Mobility Print'
const SERVER = process.env.PRINT_SERVER_HOST || '172.16.200.14'
const APPLY = process.env.PRINT_INSTALLER_APPLY === '1'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outDir = join(repoRoot, 'public', 'downloads')

// [ext, destination filename as the portal serves it]
const WANTED = [
  ['.exe', 'hexa-printer-windows.exe'],
  ['.dmg', 'hexa-printer-mac.dmg'],
]

// DOWNLOAD FROM THE SERVER, don't copy off disk.
//
// The install directory is NOT the source of truth. The macOS client is not
// stored there at all - the server produces it on request - so picking the
// newest local .dmg silently ships a stale build: on 6 Aug 2026 the directory's
// newest was 1.0.78 while the server was serving 1.0.825. The endpoints below
// are exactly what the setup pages hand to members, so this stays in step by
// construction.
const ENDPOINTS = {
  '.exe': '/known-hosts/windows',
  '.dmg': '/known-hosts/macos',
}

async function fetchInstaller(ext) {
  const url = `http://${SERVER}:9163${ENDPOINTS[ext]}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  // The server names the build in Content-Disposition, e.g.
  // attachment; filename="pc-mobility-print-printer-setup-1.0.825[172.16.200.14].dmg"
  const cd = res.headers.get('content-disposition') || ''
  const name = (cd.match(/filename="?([^"]+)"?/) || [])[1] || `(unnamed${ext})`
  const buf = Buffer.from(await res.arrayBuffer())
  return { name, buf, size: buf.length, url }
}

async function main() {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log(`Print server: ${SERVER}:9163`)
  console.log(`Target:       ${outDir}`)
  console.log(APPLY ? 'APPLY mode.\n' : 'DRY RUN (set PRINT_INSTALLER_APPLY=1 to write).\n')

  // Stale builds for a DIFFERENT server address are a trap - anyone who grabs
  // one by hand points their client at a machine that no longer exists.
  if (existsSync(MP_DIR)) {
    const strays = readdirSync(MP_DIR).filter((f) =>
      f.startsWith('pc-mobility-print-printer-setup-') && !f.includes(`[${SERVER}]`))
    if (strays.length) {
      console.log(`NOTE: ${strays.length} installer(s) on disk are built for a DIFFERENT server address.`)
      console.log('      Nothing here uses them, but consider deleting so nobody ships one by hand:')
      strays.forEach((f) => console.log('  ' + f))
      console.log('')
    }
  }

  let changed = 0
  for (const [ext, destName] of WANTED) {
    let src
    try { src = await fetchInstaller(ext) } catch (err) { console.log(`${destName}: FETCH FAILED - ${err.message}`); continue }
    const dest = join(outDir, destName)
    const current = existsSync(dest) ? statSync(dest).size : null

    if (current === src.size) {
      console.log(`${destName}: already current (${src.name})`)
      continue
    }
    console.log(`${destName}: ${current === null ? 'MISSING' : `stale (${current} bytes)`} -> ${src.name} (${src.size} bytes)`)
    if (APPLY) { writeFileSync(dest, src.buf); changed += 1 }
  }

  if (!APPLY) console.log('\nDRY RUN - nothing written.')
  else if (changed) console.log(`\nUpdated ${changed} installer(s). Commit public/downloads and redeploy the portal.`)
  else console.log('\nNothing to do - both installers were already current.')
}

main().catch((err) => { console.error('refresh failed:', err.message); process.exit(1) })
