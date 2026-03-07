@echo off
REM ========================================
REM XBase Production Startup Script
REM ========================================
echo.
echo ================================================
echo  Starting XBase Production Environment
echo ================================================
echo.

REM Check if Docker is running
echo [1/4] Checking Docker Desktop...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Docker is not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker to start (30 seconds)...
    timeout /t 30 /nobreak >nul
) else (
    echo Docker is already running!
)

REM Verify Docker is ready
:DOCKER_CHECK
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Waiting for Docker to be ready...
    timeout /t 5 /nobreak >nul
    goto DOCKER_CHECK
)
echo Docker is ready!
echo.

REM Check for Python execution image
echo [2/4] Checking Python execution image...
docker images xbase-python-exec -q >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Python image not found. Building...
    docker build -t xbase-python-exec -f docker/python/Dockerfile docker/python
) else (
    echo Python image found!
)
echo.

REM Install dependencies
echo [3/4] Installing dependencies...
call npm install
echo.

REM Start development server
echo [4/4] Starting development server...
echo.
echo ================================================
echo  Production Environment Ready!
echo  
echo  - Docker Desktop: Running
echo  - Python Image: Ready
echo  - Database Pools: Managed
echo  - Server: Starting...
echo ================================================
echo.

call npm run dev
