# The office's shortcuts: Start menu, desktop, and Start with Windows. Run by the office (src/windows.mjs) and by
# uninstall.cmd (when Node.js is gone) with fixed arguments.
#   -Where startmenu|desktop|startup   -Action status|create|remove   [-Folder <dir>]  (Folder: tests only, instead of the real one)
# Each shortcut runs "Start AI Office Overview.cmd" in this office's folder with its console window minimised. The
# Start with Windows one passes "quiet": the office starts at sign-in without opening its page.
param([string]$Where = 'desktop', [string]$Action = 'status', [string]$Folder = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$app = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))   # src\windows -> the office folder
$target = Join-Path $app 'Start AI Office Overview.cmd'
$dir = if ($Folder) { $Folder }
  elseif ($Where -eq 'startup') { [Environment]::GetFolderPath('Startup') }
  elseif ($Where -eq 'startmenu') { [Environment]::GetFolderPath('Programs') }
  else { [Environment]::GetFolderPath('Desktop') }
$lnk = Join-Path $dir 'AI Office Overview.lnk'
$sh = New-Object -ComObject WScript.Shell
switch ($Action) {
  'create' {
    $s = $sh.CreateShortcut($lnk)
    $s.TargetPath = $target
    $s.Arguments = if ($Where -eq 'startup') { 'quiet' } else { '' }
    $s.WorkingDirectory = $app
    $ico = Join-Path $app 'public\app.ico'
    if (Test-Path -LiteralPath $ico) { $s.IconLocation = $ico + ',0' }
    $s.WindowStyle = 7   # minimised: the console window the office runs in
    $s.Description = 'AI Office Overview: your Claude Code threads as staff in an office'
    $s.Save()
  }
  'remove' { if (Test-Path -LiteralPath $lnk) { Remove-Item -LiteralPath $lnk -Force } }
}
# here: the shortcut points at this office's folder. After the folder is moved, a shortcut still exists but starts
# nothing: the page then offers to point it here again.
$exists = Test-Path -LiteralPath $lnk
$here = $false
if ($exists) { try { $here = ($sh.CreateShortcut($lnk).TargetPath -ieq $target) } catch { $here = $false } }
ConvertTo-Json -Compress -InputObject ([pscustomobject]@{ where = $Where; path = $lnk; exists = $exists; here = $here })
