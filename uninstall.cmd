@echo off
rem Takes AI Office Overview off this PC's menus: stops it, removes the Start menu and desktop shortcuts and Start with
rem Windows (this Windows user only), and takes advanced setup's hooks out of Claude's settings. Your files are not
rem deleted: it says which folder to delete yourself. Setup > About > Uninstall in the office does the same.
setlocal
cd /d "%~dp0"
title AI Office Overview uninstall
echo.
echo  AI Office Overview uninstall
echo  ============================
echo.
set "NODE=node"
if exist "%~dp0node\node.exe" set "NODE=%~dp0node\node.exe"
"%NODE%" -v >nul 2>&1 || goto :no_node
"%NODE%" tools\setup.mjs uninstall
goto :done

:no_node
rem Without Node.js the office cannot be running: take the three shortcuts away directly.
for %%w in (startmenu desktop startup) do "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0src\windows\shortcut.ps1" -Where %%w -Action remove >nul
echo  The Start menu shortcut, the desktop shortcut and Start with Windows are removed.
echo  AI Office Overview's files are still in %~dp0
echo  Delete that folder to remove it completely.

:done
echo.
if /i not "%AI_OFFICE_INSTALL_NO_START%"=="1" pause
exit /b 0
