SET DIR=%~dp0
SET TRILIUM_DATA_DIR=%DIR%\trilium-data
cd %DIR%
WHERE powershell.exe
IF %ERRORLEVEL% NEQ 0 (start trilium.exe) ELSE (powershell.exe ./trilium-portable.ps1)