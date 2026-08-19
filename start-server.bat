@echo off
title Capstone Project - Localhost Server
echo ========================================================
echo   Starting Capstone Portal Localhost Server (Port 3000)
echo ========================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your PATH!
    echo Please install Node.js or run with Docker instead.
    echo.
    pause
    exit /b 1
)

:: Launch browser after 1 second delay in background
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:3000"

:: Start the Node server
node server.js
