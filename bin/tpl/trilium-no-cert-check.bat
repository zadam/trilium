SET DIR=%~dp0
set NODE_TLS_REJECT_UNAUTHORIZED=0
cd %DIR%
WHERE powershell.exe
IF %ERRORLEVEL% NEQ 0 (start trilium.exe) ELSE (powershell.exe ./trilium-no-cert-check.ps1)