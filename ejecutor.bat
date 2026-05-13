@echo off
color 0B
echo ==========================================================
echo               INICIANDO PEIE TOOLS (PWA)
echo ==========================================================
echo.

REM Verificar si la carpeta node_modules existe, si no, instalar dependencias
IF NOT EXIST node_modules (
    echo [INFO] No se encontraron las dependencias instaladas.
    echo [INFO] Iniciando instalacion de paquetes, esto puede demorar un poco...
    call npm install --legacy-peer-deps
    echo.
    echo [OK] Dependencias instaladas correctamente.
    echo.
)

echo [INFO] Iniciando el servidor y abriendo el navegador automáticamente...
echo [INFO] Presiona CTRL+C en esta ventana para detenerlo.
echo.

REM Iniciar el servidor de desarrollo y abrir el navegador
call npm run dev -- --open

pause
