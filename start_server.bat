@echo off
setlocal
REM This script prefers to use the Node.js workflow when npm is available.
REM If npm is not found, it will attempt to initialize the SQLite DB via PHP and
REM then open the project in the default browser (assumes Apache from XAMPP is running).

where npm >nul 2>&1
if %ERRORLEVEL%==0 (
  echo npm found — using Node workflow.
  echo Installing dependencies...
  npm install
  if errorlevel 1 (
    echo npm install failed. Ensure Node.js and npm are installed correctly.
    pause
    exit /b 1
  )
  echo Initializing database (node)...
  npm run init-db
  if errorlevel 1 (
    echo init-db failed.
    pause
    exit /b 1
  )
  echo Starting server (node)...
  npm start
  endlocal
  exit /b 0
)

echo npm not found — falling back to PHP-based initialization.
echo Make sure Apache is running in XAMPP Control Panel before opening the site.
if exist "%~dp0\php_api\init_db.php" (
  if exist "C:\xampp\php\php.exe" (
    echo Running PHP init script using XAMPP PHP...
    "C:\xampp\php\php.exe" "%~dp0php_api\init_db.php"
  ) else (
    echo php executable not found at C:\xampp\php\php.exe. You can run the init script manually with a PHP executable on PATH.
  )
) else (
  echo init script not found: %~dp0php_api\init_db.php
)

echo Opening project in default browser...
start "" "http://localhost/clinica-asklepion-main/"
endlocal
