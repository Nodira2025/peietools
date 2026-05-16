@echo off
set "msg=Actualizacion de sistema"
set /p userMsg="Mensaje del commit (Enter para usar por defecto): "
if not "%userMsg%"=="" set "msg=%userMsg%"

echo.
echo === Preparando archivos ===
git add .

echo === Creando commit: %msg% ===
git commit -m "%msg%"

echo === Subiendo a GitHub ===
git push

echo.
echo === Proceso finalizado correctamente ===
echo === Netlify comenzara a actualizar la web en 1 minuto ===
echo.
pause
