@echo off
REM LocalSend - Install and Run Script
REM This script installs all dependencies and starts the dev server (Netlify-ready)

setlocal enabledelayedexpansion
color 0A

echo.
echo ========================================
echo  LocalSend - Web Application
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
call node --version
echo.

REM Check if npm is available
where npm >nul 2>nul
if errorlevel 1 (
    echo Error: npm is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if node_modules exists
if exist node_modules (
    echo [INFO] Dependencies already installed, skipping npm install...
    echo.
) else (
    echo [INFO] Installing dependencies...
    echo This may take a few minutes on first run...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] Dependencies installed successfully!
    echo.
)

REM Start the dev server
echo [INFO] Starting dev server...
echo [INFO] The app will be available at http://localhost:8080
echo [INFO] Press Ctrl+C to stop the server
echo [INFO] This project is configured for Netlify deployment
echo.

call npm run dev

pause
