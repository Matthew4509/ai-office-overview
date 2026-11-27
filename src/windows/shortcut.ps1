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
# WScript.Shell writes a shortcut's paths in the Windows ANSI code page, so a folder named with letters outside it
# (Cyrillic, Greek, CJK, or a Windows user name in them) got a shortcut to a folder that does not exist, or none. The
# shortcut is made through the shell's own Unicode interface instead (IShellLinkW), and read back through
# Shell.Application, which keeps every letter too.
function Get-Target([string]$file) {
  $item = (New-Object -ComObject Shell.Application).NameSpace([IO.Path]::GetDirectoryName($file)).ParseName([IO.Path]::GetFileName($file))
  if (-not $item) { return '' }
  return [string]$item.GetLink.Path
}
$failed = ''
switch ($Action) {
  'create' {
    try {
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
      $arg = if ($Where -eq 'startup') { 'quiet' } else { '' }
      [AiOfficeLink]::Save($lnk, $target, $arg, $app, $ico, 'AI Office Overview: your Claude Code threads as staff in an office')
    } catch { $failed = "the shortcut could not be made ($($_.Exception.Message.Trim()))" }
  }
  'remove' { if (Test-Path -LiteralPath $lnk) { Remove-Item -LiteralPath $lnk -Force } }
}
# here: the shortcut points at this office's folder. After the folder is moved, a shortcut still exists but starts
# nothing: the page then offers to point it here again.
$exists = Test-Path -LiteralPath $lnk
$here = $false
if ($exists) { try { $here = ((Get-Target $lnk) -ieq $target) } catch { $here = $false } }
# A shortcut that was saved but points elsewhere is a failure, not a success.
if ($Action -eq 'create' -and -not $failed -and -not $here) { $failed = 'the shortcut was saved, but it does not point at this office''s folder' }
$out = [ordered]@{ where = $Where; path = $lnk; exists = $exists; here = $here }
if ($failed) { $out.error = $failed }
ConvertTo-Json -Compress -InputObject ([pscustomobject]$out)
