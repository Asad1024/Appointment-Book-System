@echo off
cd /d "%~dp0"

echo Freeing ports 3000 and 3001...
for %%P in (3000 3001) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%A >nul 2>&1
  )
)

call npm.cmd run dev
