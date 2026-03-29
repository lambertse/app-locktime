; installer.nsh — Custom NSIS hooks for LockTime
; Runs during electron-builder's NSIS install/uninstall process.
; Handles the Go background service (locktime-svc.exe) lifecycle.

!define SERVICE_NAME "LockTimeSvc"

; ─── On Install Complete ────────────────────────────────────────────────────
; Called after Electron app files are copied to $INSTDIR
!macro customInstall
  DetailPrint "Installing LockTime background service..."

  ; Copy service binaries from Electron's extraResources to INSTDIR
  ; electron-builder puts extraResources in $INSTDIR\resources\bin\
  CopyFiles "$INSTDIR\resources\bin\locktime-svc.exe" "$INSTDIR"
  CopyFiles "$INSTDIR\resources\bin\blocker.exe" "$INSTDIR"

  ; Install and start the Windows service
  ExecWait '"$INSTDIR\locktime-svc.exe" --install' $0
  DetailPrint "Service install exit code: $0"

  ExecWait 'net start ${SERVICE_NAME}' $0
  DetailPrint "Service start exit code: $0"

  ; Create data directory (service auto-creates but pre-create ACLs)
  CreateDirectory "$APPDATA\locktime"
!macroend

; ─── On Uninstall ───────────────────────────────────────────────────────────
!macro customUninstall
  DetailPrint "Stopping and removing LockTime background service..."

  ExecWait 'net stop ${SERVICE_NAME}' $0
  DetailPrint "Service stop exit code: $0"

  ExecWait '"$INSTDIR\locktime-svc.exe" --uninstall' $0
  DetailPrint "Service uninstall exit code: $0"

  ; Remove binaries
  Delete "$INSTDIR\locktime-svc.exe"
  Delete "$INSTDIR\blocker.exe"
!macroend
