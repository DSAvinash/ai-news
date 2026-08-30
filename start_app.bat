@echo off
set PATH=C:\Program Files\nodejs;C:\Users\shaku\AppData\Roaming\npm;%PATH%
cd /d C:\Users\shaku\.gemini\antigravity\scratch\ai-intelligence-radar
powershell -Command "Start-Process node -ArgumentList 'node_modules/tsx/dist/cli.mjs server/index.ts' -WorkingDirectory 'C:\Users\shaku\.gemini\antigravity\scratch\ai-intelligence-radar' -WindowStyle Hidden"
echo =======================================================================
echo 🚀 AI Intelligence Radar Application Server started!
echo =======================================================================
echo Web Application Live: http://localhost:3000
echo Production Direct API: http://localhost:3001
echo =======================================================================
