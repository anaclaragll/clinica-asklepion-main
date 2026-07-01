@echo off
php -v >nul 2>&1
if errorlevel 1 (
  echo PHP not found. Install PHP 8+ and make sure php.exe is on PATH.
  pause
  exit /b 1
)
echo Starting PHP built-in server on http://localhost:3000
php -S localhost:3000 router.php
