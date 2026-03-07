# XBase Production Startup Script (PowerShell)
# ===============================================

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Starting XBase Production Environment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "[1/4] Checking Docker Desktop..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
        Write-Host "Docker is already running!" -ForegroundColor Green
    }
} catch {
    $dockerRunning = $false
}

if (-not $dockerRunning) {
    Write-Host "Docker is not running. Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "Waiting for Docker to start (30 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # Wait for Docker to be ready
    $maxAttempts = 12
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            docker info 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Docker is ready!" -ForegroundColor Green
                break
            }
        } catch {}
        $attempt++
        Write-Host "Waiting for Docker to be ready... (attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Host "ERROR: Docker failed to start. Please start Docker Desktop manually." -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Check for Python execution image
Write-Host "[2/4] Checking Python execution image..." -ForegroundColor Yellow
$imageExists = docker images xbase-python-exec -q
if (-not $imageExists) {
    Write-Host "Python image not found. Building..." -ForegroundColor Yellow
    docker build -t xbase-python-exec -f docker/python/Dockerfile docker/python
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to build Python image" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Python image found!" -ForegroundColor Green
}
Write-Host ""

# Install dependencies
Write-Host "[3/4] Installing dependencies..." -ForegroundColor Yellow
npm install
Write-Host ""

# Start development server
Write-Host "[4/4] Starting development server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " Production Environment Ready!" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "  - Docker Desktop: Running" -ForegroundColor Green
Write-Host "  - Python Image: Ready" -ForegroundColor Green
Write-Host "  - Database Pools: Managed" -ForegroundColor Green
Write-Host "  - Server: Starting..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

npm run dev
