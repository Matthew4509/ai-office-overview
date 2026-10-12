@echo off
rem Starts AI Office Overview on this PC and opens it in the browser once it is ready.
cd /d "%~dp0"
where node >nul 2>nul || (echo AI Office Overview needs Node.js 20 or newer: https://nodejs.org/ & pause & exit /b 1)
node server.mjs --open
pause
