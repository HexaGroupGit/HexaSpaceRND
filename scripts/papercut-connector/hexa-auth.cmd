@echo off
rem PaperCut MF custom auth program wrapper — Hexa portal credentials.
rem Point PaperCut's auth.source.custom-program at THIS file, and set
rem auth.source.env-vars to: HEXA_AUTH_CONFIG=<path to hexa-config.json>
rem (Adjust the paths below to where you install node + these files.)
node "%~dp0auth-provider.mjs"
