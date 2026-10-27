@echo off
rem Builds the Windows installer, installer\out\AI-Office-Overview-Setup-<version>.exe, with Inno Setup 6.
rem   1. Needs Inno Setup 6 (winget install --id JRSoftware.InnoSetup -e) and Node.js 20 or newer on this PC.
rem   2. Stages the office's files in installer\stage (the same list the public repository ships, no data folder, no
rem      notes), plus this PC's own node.exe and its licence in stage\node, so the installed copy needs nothing else.
rem   3. Runs the Inno Setup compiler with the version from package.json.
rem Run it from anywhere: installer\build.cmd. The stage folder is remade each time and is git-ignored, like out\.
setlocal
cd /d "%~dp0"
title AI Office Overview installer build
set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" (
  echo  Inno Setup 6 was not found. Install it first:  winget install --id JRSoftware.InnoSetup -e
  exit /b 1
)
where node >nul 2>nul || (echo  Node.js was not found on the PATH. & exit /b 1)
for /f "delims=" %%v in ('node -p "require('../package.json').version"') do set "VERSION=%%v"
for /f "delims=" %%p in ('node -p "process.execPath"') do set "NODE_EXE=%%p"
for /f "delims=" %%m in ('node -p "+process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%m"
if %NODE_MAJOR% LSS 20 (echo  The Node.js on this PC is too old to ship: the office needs 20 or newer. & exit /b 1)
echo  Version %VERSION%, with Node.js %NODE_MAJOR% from "%NODE_EXE%"

rem The stage: the files the public repository ships (the push copy list), nothing else.
if exist stage rmdir /s /q stage
mkdir stage\node || exit /b 1
for %%f in (AGENTS.md CLAUDE.md LICENSE README.md "Start AI Office Overview.cmd" hook.mjs install.cmd uninstall.cmd package.json server.mjs) do (
  if exist "..\%%~f" (copy /y "..\%%~f" "stage\" >nul) else (echo  Missing: %%~f & exit /b 1)
)
for %%d in (src public test tools) do robocopy "..\%%d" "stage\%%d" /e /njh /njs /ndl /nfl /nc /ns /np >nul
if not exist "stage\public\app.ico" node ..\tools\make-icon.mjs || exit /b 1
if not exist "stage\public\app.ico" copy /y "..\public\app.ico" "stage\public\" >nul
copy /y "%NODE_EXE%" "stage\node\node.exe" >nul || exit /b 1
for %%l in ("%NODE_EXE%\..\LICENSE") do if exist "%%~l" copy /y "%%~l" "stage\node\LICENSE" >nul

"%ISCC%" /Q "/DAppVersion=%VERSION%" ai-office-overview.iss || exit /b 1
echo.
echo  Built: installer\out\AI-Office-Overview-Setup-%VERSION%.exe
echo  It is not code-signed: Windows SmartScreen shows "unknown publisher" the first time it runs (More info, Run anyway).
exit /b 0
