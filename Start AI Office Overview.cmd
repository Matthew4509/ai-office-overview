@echo off
rem Starts AI Office Overview on this PC and opens its page once it is ready. Keep the window open while you use the
rem office (a shortcut made by install.cmd keeps it minimised). Closing the window stops the office; so does
rem Setup > About > Quit. Starting it again while it runs says so and stops.
rem   "Start AI Office Overview.cmd quiet"   (Start with Windows) starts it without opening the page.
rem A copy put on this PC by the installer carries its own Node.js in node\ and uses that; otherwise the Node.js on
rem the PATH (20 or newer) is used. First time on this PC? Double-click install.cmd: it checks Node.js and sets up the
rem shortcuts.
cd /d "%~dp0"
set "NODE=%~dp0node\node.exe"
if exist "%NODE%" goto :run
set "NODE=node"
where node >nul 2>nul || goto :no_node
node -e "process.exit(+process.versions.node.split('.')[0]>=20?0:1)" || goto :old_node
:run
title AI Office Overview
if /i "%~1"=="quiet" ("%NODE%" server.mjs) else ("%NODE%" server.mjs --open)
if errorlevel 1 if /i not "%~1"=="quiet" pause
exit /b

:no_node
echo.
echo  AI Office Overview needs Node.js, and it is not installed on this PC (or not on the PATH).
echo  Double-click install.cmd: it can install Node.js for you. Or install the LTS version from
echo  https://nodejs.org (the default options are fine), then double-click this file again.
echo.
pause
exit /b 1

:old_node
echo.
for /f "delims=" %%v in ('node -v') do echo  AI Office Overview needs Node.js 20 or newer; this PC has %%v.
echo  Double-click install.cmd: it can update Node.js for you.
echo.
pause
exit /b 1
