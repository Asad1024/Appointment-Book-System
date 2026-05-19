@echo off
echo Stopping app on ports 3000 and 3001...
for %%P in (3000 3001) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
    echo Killing PID %%A on port %%P
    taskkill /F /PID %%A >nul 2>&1
  )
)
echo Done.
