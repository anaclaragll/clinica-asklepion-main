Write-Host "Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed. Install Node.js and npm."; exit 1 }
Write-Host "Initializing database..."
npm run init-db
if ($LASTEXITCODE -ne 0) { Write-Error "init-db failed"; exit 1 }
Write-Host "Starting server..."
npm start
