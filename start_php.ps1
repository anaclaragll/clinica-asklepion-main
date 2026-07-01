if (-not (Get-Command php -ErrorAction SilentlyContinue)) { Write-Error "PHP not found. Install PHP 8+ and ensure php.exe is on PATH."; exit 1 }
Write-Host "Starting PHP built-in server on http://localhost:3000"
php -S localhost:3000 router.php
