@echo off
rem AI Office Overview setup. Double-click it once (or again any time: it only sets things up, never removes your data).
rem   1. Checks Node.js 20 or newer is installed; if not, offers to install the LTS version with winget (Windows'
rem      own installer, it asks before it changes anything), or points to nodejs.org.
rem   2. Puts the office in the Start menu, then asks about a desktop shortcut and Start with Windows (all for this
rem      Windows user only, no administrator needed): node tools\setup.mjs install.
rem   3. Starts the office and opens its page.
rem uninstall.cmd undoes step 2. Setup > Setup does step 2 from inside the office.
setlocal
cd /d "%~dp0"
title AI Office Overview setup
echo.
echo  AI Office Overview setup
echo  ========================
echo.

:check_node
set "NODE_MAJOR="
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR goto :no_node
if %NODE_MAJOR% LSS 20 goto :old_node
for /f "delims=" %%v in ('node -v') do echo  Node.js %%v found. Good.
echo.
node tools\setup.mjs install %*
if errorlevel 1 (
  echo.
  pause
)
if /i "%AI_OFFICE_INSTALL_NO_START%"=="1" exit /b 0
echo.
echo  Starting the office...
start "" "%~dp0Start AI Office Overview.cmd"
exit /b 0

:old_node
echo  AI Office Overview needs Node.js 20 or newer. This PC has Node.js %NODE_MAJOR%.
goto :offer_node
:no_node
echo  AI Office Overview needs Node.js 20 or newer, and Node.js is not installed on this PC (or not on the PATH).
:offer_node
echo.
where winget >nul 2>&1 || goto :manual_node
set "ANSWER="
set /p "ANSWER= Install the Node.js LTS version now with winget? [Y/n] "
if /i "%ANSWER:~0,1%"=="n" goto :manual_node
echo.
winget install --id OpenJS.NodeJS.LTS -e --source winget
rem This window still has the old PATH: use the new Node.js from where its installer puts it.
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
set "NODE_MAJOR="
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%v"
if defined NODE_MAJOR if %NODE_MAJOR% GEQ 20 (
  echo.
  goto :check_node
)
echo.
echo  Node.js did not install. Close this window, then double-click install.cmd again.
goto :manual_node_tail

:manual_node
echo.
echo  Install the LTS version from https://nodejs.org (the default options are fine),
echo  then double-click install.cmd again.
:manual_node_tail
echo.
pause
exit /b 1
