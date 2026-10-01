@echo off
REM Sube los cambios del proyecto a GitHub (Netlify redespliega solo).
cd /d "%~dp0"

echo ============================================
echo   Subir cambios - Rondas de Guardias
echo ============================================
echo.

set "msg="
set /p msg=Mensaje del commit (Enter para uno automatico):
if "%msg%"=="" set "msg=Actualizacion %date% %time%"

echo.
git add -A
git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo No habia cambios para commitear. Intento push igual...
)

echo.
git push
echo.

if errorlevel 1 (
  echo *** Hubo un error al hacer push. Revisa el mensaje de arriba. ***
) else (
  echo *** Listo: cambios subidos. Netlify va a redesplegar en un minuto. ***
)

echo.
pause
