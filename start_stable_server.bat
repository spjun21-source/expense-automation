@echo off
setlocal
title Bio-Core Expense Local Server
echo Starting Stable Local Server for Expense Automation...
cd /d "C:\Users\spjun\.gemini\antigravity\scratch\expense-automation"
"C:\Users\spjun\.gemini\antigravity\scratch\AI Core\venv\Scripts\python.exe" -m http.server 8000
pause
