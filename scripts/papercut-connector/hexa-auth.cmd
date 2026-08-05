@echo off
rem PaperCut MF custom auth program wrapper - Hexa portal credentials.
rem Point PaperCut's auth.source.custom-program at THIS file, and set
rem auth.source.env-vars to: HEXA_AUTH_CONFIG=<path to hexa-config.json>
rem
rem NODE IS INVOKED BY ABSOLUTE PATH, DELIBERATELY. PaperCut runs this as
rem LocalSystem, and a Windows service inherits its environment from the Service
rem Control Manager as it stood AT BOOT - so a PATH entry added since the last
rem reboot is invisible to it even across a service restart. A bare "node" here
rem fails with "'node' is not recognized", PaperCut sees exit code 1, and EVERY
rem member login is refused. (That is exactly what happened on 4 Aug 2026 during
rem the cutover - the machine PATH contained nodejs, and it still did not work.)
rem The PATH fallback below only matters on a host where node lives elsewhere.
setlocal
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" "%~dp0auth-provider.mjs"
