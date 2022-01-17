SET DIR=%~dp0
SET TRILIUM_SAFE_MODE=1
cd %DIR%
WHERE powershell.exe
IF %ERRORLEVEL% NEQ 0 (start trilium.exe) ELSE (powershell.exe ./trilium-safe-mode.ps1)