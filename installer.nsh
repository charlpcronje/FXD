; Custom NSIS installer script for FXD Quantum Visualizer

; Register .fxd file association
!macro customInstall
  WriteRegStr HKCR ".fxd" "" "FXDFile"
  WriteRegStr HKCR "FXDFile" "" "FXD Quantum Development File"
  WriteRegStr HKCR "FXDFile\DefaultIcon" "" "$INSTDIR\resources\app\assets\icon.ico"
  WriteRegStr HKCR "FXDFile\shell\open\command" "" '"$INSTDIR\$EXEFILE" "%1"'

  ; Add to "Open with" menu
  WriteRegStr HKCR "FXDFile\shell\open" "FriendlyAppName" "FXD Quantum Visualizer"

  ; Refresh icon cache
  System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

; Unregister file association
!macro customUnInstall
  DeleteRegKey HKCR ".fxd"
  DeleteRegKey HKCR "FXDFile"

  ; Refresh icon cache
  System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend
