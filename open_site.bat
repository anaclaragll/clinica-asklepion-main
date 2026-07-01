@echo off
setlocal
set "DIR=%~dp0"
cd /d "%DIR%"

REM ── Verifica se o Node.js está instalado ─────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo Node.js nao encontrado. Instale em https://nodejs.org e tente novamente.
  pause
  exit /b 1
)

REM ── Instala dependencias se node_modules nao existir ─────────────────────
if not exist "node_modules\" (
  echo Instalando dependencias (npm install)...
  npm install
  if errorlevel 1 ( echo npm install falhou. & pause & exit /b 1 )
)

REM ── Inicializa o banco se nao existir ────────────────────────────────────
if not exist "db\clinica.db" (
  echo Inicializando banco de dados...
  node db\init_db.js
)

REM ── Verifica se o servidor ja esta rodando na porta 3000 ─────────────────
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo Servidor ja esta rodando na porta 3000.
) else (
  echo Iniciando servidor Node.js na porta 3000...
  start "Asklepion API Server" cmd /k "cd /d "%DIR%" && node server.js"
  timeout /t 2 /nobreak >nul
)

REM ── Abre o site no navegador ─────────────────────────────────────────────
echo Abrindo site...
start "" "http://localhost/clinica-asklepion-main/"
endlocal
