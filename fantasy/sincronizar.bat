@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py sincronizar.py) else (python sincronizar.py)
echo.
pause
