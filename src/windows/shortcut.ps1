# The office's shortcuts: Start menu, desktop, and Start with Windows. Run by the office (src/windows.mjs) and by
# uninstall.cmd (when Node.js is gone) with fixed arguments.
#   -Where startmenu|desktop|startup   -Action status|create|remove   [-Folder <dir>]  (Folder: tests only, instead of the real one)
# Each shortcut runs "Start AI Office Overview.cmd" in this office's folder with its console window minimised. It runs
# it through cmd.exe, which first changes to the office's folder and then names the file relative to it (.\): a
# shortcut to the .cmd file itself, or one whose working folder holds %PATH% (or any %...%), has that read as a
# variable on the way in, by Windows or by cmd, and starts nothing. The working folder is still set (it says which
# copy the shortcut belongs to). The Start with Windows one passes "quiet": the office starts at sign-in without
# opening its page.
# Every copy of the office (a clone, a zip copy, the installed one) uses the same shortcut name. A shortcut that starts
# another copy that is still there belongs to that copy: create says so and leaves it, and remove keeps it.
param([string]$Where = 'desktop', [string]$Action = 'status', [string]$Folder = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$app = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')).TrimEnd('\')   # src\windows -> the office folder
$start = 'Start AI Office Overview.cmd'
$cmd = Join-Path ([Environment]::SystemDirectory) 'cmd.exe'
$dir = if ($Folder) { $Folder }
  elseif ($Where -eq 'startup') { [Environment]::GetFolderPath('Startup') }
  elseif ($Where -eq 'startmenu') { [Environment]::GetFolderPath('Programs') }
  else { [Environment]::GetFolderPath('Desktop') }
$lnk = Join-Path $dir 'AI Office Overview.lnk'
# WScript.Shell writes a shortcut's paths in the Windows ANSI code page, so a folder named with letters outside it
# (Cyrillic, Greek, CJK, or a Windows user name in them) got a shortcut to a folder that does not exist, or none. The
# shortcut is made through the shell's own Unicode interface instead (IShellLinkW), and read back through
# Shell.Application, which keeps every letter too.
function Get-Link([string]$file) {
  $item = (New-Object -ComObject Shell.Application).NameSpace([IO.Path]::GetDirectoryName($file)).ParseName([IO.Path]::GetFileName($file))
  if (-not $item) { return $null }
  return $item.GetLink
}
# The office folder a shortcut starts, or '' when it is not an office shortcut. Two forms count: the one made here
# (cmd.exe, naming the start file, in the office's folder) and the one older versions and the installer make (the start
# file by its full path).
function Get-Owner([string]$file) {
  $l = Get-Link $file
  if (-not $l) { return '' }
  $path = [string]$l.Path
  if ([IO.Path]::GetFileName($path) -ieq $start) { return [IO.Path]::GetDirectoryName($path).TrimEnd('\') }
  if (([IO.Path]::GetFileName($path) -ieq 'cmd.exe') -and (([string]$l.Arguments).IndexOf($start, [StringComparison]::OrdinalIgnoreCase) -ge 0)) {
    $wd = [string]$l.WorkingDirectory
    if ($wd) { return [IO.Path]::GetFullPath($wd).TrimEnd('\') }
  }
  return ''
}
$owner = ''
if (Test-Path -LiteralPath $lnk) { try { $owner = Get-Owner $lnk } catch { $owner = '' } }
# Another copy's shortcut: it starts an office folder that is not this one and is still there. One whose folder is gone
# (the office was moved) starts nothing, and create points it here again.
$other = $owner -and ($owner -ine $app) -and (Test-Path -LiteralPath (Join-Path $owner $start))
$failed = ''
switch ($Action) {
  'create' {
    if ($other) { $failed = "a shortcut of the same name starts the copy of the office in $owner, so it was left alone (remove that copy's shortcut from its own Setup first)" }
    else { try {
      Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
public static class AiOfficeLink {
  [ComImport, Guid("00021401-0000-0000-C000-000000000046")] class ShellLink {}
  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
  interface IShellLinkW {
    void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder f, int cch, IntPtr fd, int flags);
    void GetIDList(out IntPtr pidl);
    void SetIDList(IntPtr pidl);
    void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder s, int cch);
    void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string s);
    void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder s, int cch);
    void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string s);
    void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder s, int cch);
    void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string s);
    void GetHotkey(out short k);
    void SetHotkey(short k);
    void GetShowCmd(out int c);
    void SetShowCmd(int c);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder s, int cch, out int i);
    void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string s, int i);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string s, int r);
    void Resolve(IntPtr hwnd, int flags);
    void SetPath([MarshalAs(UnmanagedType.LPWStr)] string s);
  }
  public static void Save(string lnk, string target, string args, string dir, string icon, string desc) {
    IShellLinkW l = (IShellLinkW)new ShellLink();
    l.SetPath(target);
    l.SetArguments(args);
    l.SetWorkingDirectory(dir);
    if (icon.Length > 0) l.SetIconLocation(icon, 0);
    l.SetShowCmd(7); // minimised: the console window the office runs in
    l.SetDescription(desc);
    ((IPersistFile)l).Save(lnk, true);
  }
}
'@
      $ico = Join-Path $app 'public\app.ico'
      if (-not (Test-Path -LiteralPath $ico)) { $ico = '' }
      # cd /d takes the folder without quotes (it allows spaces), so cmd's own escapes work on it: ^ before each of
      # ^ & | < > ( ), and ^ after each % so no %NAME% in the folder's name is read as a variable.
      $esc = ($app.Replace('^', '^^') -replace '[&|<>()]', '^$0').Replace('%', '%^')
      $arg = "/d /c cd /d $esc && "".\$start"""
      if ($Where -eq 'startup') { $arg += ' quiet' }
      [AiOfficeLink]::Save($lnk, $cmd, $arg, $app, $ico, 'AI Office Overview: your Claude Code threads as staff in an office')
    } catch { $failed = "the shortcut could not be made ($($_.Exception.Message.Trim()))" } }
  }
  # Only this folder's own shortcut goes. One that starts another copy, or is not the office's at all, stays.
  'remove' { if ($owner -and ($owner -ieq $app)) { Remove-Item -LiteralPath $lnk -Force } }
}
# here: the shortcut starts this office's folder. After the folder is moved, a shortcut still exists but starts
# nothing: the page then offers to point it here again. owner: the folder a shortcut that is not this one's starts.
$exists = Test-Path -LiteralPath $lnk
$now = ''
if ($exists) { try { $now = Get-Owner $lnk } catch { $now = '' } }
$here = [bool]($exists -and $now -and ($now -ieq $app))
# A shortcut that was saved but points elsewhere is a failure, not a success.
if ($Action -eq 'create' -and -not $failed -and -not $here) { $failed = 'the shortcut was saved, but it does not point at this office''s folder' }
$out = [ordered]@{ where = $Where; path = $lnk; exists = $exists; here = $here }
if ($exists -and -not $here -and $now) { $out.owner = $now }
if ($Action -eq 'remove' -and $exists) { $out.kept = $true }
if ($failed) { $out.error = $failed }
ConvertTo-Json -Compress -InputObject ([pscustomobject]$out)
