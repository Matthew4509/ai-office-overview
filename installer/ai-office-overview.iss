; AI Office Overview: the Windows installer (Inno Setup 6). Built by installer\build.cmd, which stages the files and
; passes the version. One .exe, no administrator needed: it installs for this Windows user only, under
; %LOCALAPPDATA%\Programs\AI Office Overview, with its own copy of Node.js in node\ (so nothing else is needed), a Start
; menu shortcut, and the two optional ones (desktop, Start with Windows). It appears under Settings > Apps, where
; Uninstall stops the office, takes advanced setup's hooks out of Claude's settings, removes the shortcuts and the
; program files, and asks before deleting the data folder (names, looks, rewards and the ledger).
;
; An installed copy has no git folder, so Setup > Update in the office says to get the new installer instead.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppName "AI Office Overview"

[Setup]
AppId={{7F3E2C9A-4B61-4F0A-9C2D-A10F0E5B7C21}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppName}
AppPublisherURL=https://github.com/Matthew4509/ai-office-overview
AppSupportURL=https://github.com/Matthew4509/ai-office-overview
AppUpdatesURL=https://github.com/Matthew4509/ai-office-overview/releases
DefaultDirName={localappdata}\Programs\{#AppName}
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
OutputDir=out
OutputBaseFilename=AI-Office-Overview-Setup-{#AppVersion}
SetupIconFile=..\public\app.ico
UninstallDisplayIcon={app}\public\app.ico
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile=stage\LICENSE
; The installed folder must have no $, backtick, quote or % in its path (advanced setup refuses one): the default has none.

[Tasks]
Name: "desktopicon"; Description: "Put an {#AppName} shortcut on the desktop"; GroupDescription: "Shortcuts:"
Name: "startup"; Description: "Start the office quietly when I sign in to Windows"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "stage\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion
; data\ is never in the stage: the office makes it on its first start, and uninstall asks before deleting it.

[Icons]
Name: "{userprograms}\{#AppName}"; Filename: "{app}\Start AI Office Overview.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\public\app.ico"; Comment: "Your Claude Code threads as staff in an office"; Flags: runminimized
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\Start AI Office Overview.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\public\app.ico"; Comment: "Your Claude Code threads as staff in an office"; Flags: runminimized; Tasks: desktopicon
Name: "{userstartup}\{#AppName}"; Filename: "{app}\Start AI Office Overview.cmd"; Parameters: "quiet"; WorkingDir: "{app}"; IconFilename: "{app}\public\app.ico"; Flags: runminimized; Tasks: startup

[Run]
Filename: "{app}\Start AI Office Overview.cmd"; WorkingDir: "{app}"; Description: "Start {#AppName} now"; Flags: postinstall nowait shellexec runminimized skipifsilent

[UninstallRun]
; Stops the office (if it runs), takes the hooks out of Claude's settings and the shortcuts away, before the files go.
Filename: "{app}\node\node.exe"; Parameters: """{app}\tools\setup.mjs"" uninstall"; WorkingDir: "{app}"; Flags: runhidden waituntilterminated; RunOnceId: "StopAndClean"

[Code]
// A running office holds no installed file open for long, but its page would be served from a folder between two
// versions: stop it first, then the files are replaced.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code: Integer;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\node\node.exe')) and FileExists(ExpandConstant('{app}\server.mjs')) then
    Exec(ExpandConstant('{app}\node\node.exe'), '"' + ExpandConstant('{app}\server.mjs') + '" --stop', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, Code);
end;

// Uninstall removes what it installed. The data folder is the person's own (names, looks, rewards, the ledger), so
// it is asked about, and kept unless they say delete.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Data: String;
begin
  if CurUninstallStep = usPostUninstall then begin
    Data := ExpandConstant('{app}\data');
    if DirExists(Data) then begin
      // SuppressibleMsgBox: a silent uninstall (/SUPPRESSMSGBOXES) takes No and keeps the data, instead of waiting.
      if SuppressibleMsgBox('Also delete the office''s data folder?' + #13#10 + Data + #13#10#13#10 + 'It holds the names and looks you gave the staff, the rewards you bought and the token ledger. Choose No to keep it for a later install.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2, IDNO) = IDYES then
        DelTree(Data, True, True, True);
    end;
    if DirExists(ExpandConstant('{app}')) then RemoveDir(ExpandConstant('{app}'));
  end;
end;
