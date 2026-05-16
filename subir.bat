@echo off
set /p msg="Mensaje del commit: "
git add .
git commit -m "%msg%"
git push
echo.
echo === Cambios subidos correctamente ===
pause
