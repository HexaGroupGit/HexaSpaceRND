@echo off
rem PaperCut MF custom USER SOURCE wrapper - Hexa roster as the user directory.
rem Point PaperCut's user-source.custom-program at THIS file.
rem
rem Node is invoked by ABSOLUTE PATH for the same reason as hexa-auth.cmd:
rem PaperCut runs this as LocalSystem, whose PATH comes from the Service Control
rem Manager as it stood at boot. A bare "node" fails with "'node' is not
rem recognized" - which on the auth side refused every login on 4 Aug 2026.
rem
rem All arguments are passed straight through - PaperCut puts the query
rem (is-valid-user, all-users, get-user-details, ...) in argv.
rem The config path is set HERE rather than relying on a user-source.env-vars
rem config key: that key reads back empty, and an empty read from getConfigValue
rem means "unset OR not a real key" - the same ambiguity that sent the overdraft
rem work chasing a ghost. Deriving it from this script's own directory removes
rem the dependency. An externally supplied value still wins, for testing.
setlocal
if not defined HEXA_AUTH_CONFIG set "HEXA_AUTH_CONFIG=%~dp0hexa-config.json"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" "%~dp0user-source-provider.mjs" %*
