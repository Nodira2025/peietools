# Navegación: compras dentro de Logística y Reportes oculto

Pedido de la empresa del 14/09/2026: poner el registro de compras dentro de Logística y ocultar temporalmente la pestaña Reportes hasta contar con información suficiente para diseñar el módulo.

## Cambios

- `src/config/navigationFeatures.ts`: `SHOW_REPORTS = false` y `SHOW_PURCHASES_SHORTCUT = false`.
- `src/layouts/AppLayout.tsx`: oculta Reportes y Registro de Compras en la navegación principal y Reportes KPI en el menú móvil. Logística conserva el acceso para los perfiles/modos que podían ver el registro de compras.
- `src/pages/Dashboard.tsx`: oculta el acceso directo a Registro de Compras y Registro de Tareas (este último abría Reportes).
- `src/pages/Logistica.tsx`: agrega el botón Registro de Compras en el encabezado, junto a Reportar Compra, y oculta Historial de Reportes. Elimina la indicación obsoleta “PC” del registro, accesible también desde móvil.
- `src/pages/Compras.tsx`: agrega Volver a Logística.

Se conservan las páginas, rutas `/compras`, `/compras/:id` y `/reportes`, registros y permisos existentes. Reportes queda oculto de la navegación, pero la URL directa sigue existiendo: esto no es un bloqueo de autorización. No se modifica Reportar Tarea ni los informes internos de otros módulos.

## Reversión para otra IA

1. Revisar `git status` y preservar cambios posteriores o ajenos.
2. Para mostrar Reportes nuevamente, cambiar `SHOW_REPORTS` a `true` en `src/config/navigationFeatures.ts`.
3. Para recuperar los accesos directos de compras en Inicio y el menú, cambiar `SHOW_PURCHASES_SHORTCUT` a `true`. El acceso dentro de Logística permanece disponible.
4. Para revertir el cambio completo, localizar el commit con `git log --oneline --grep="Mover compras a Logistica y ocultar Reportes"`, revisar `git show <COMMIT>` y aplicar `git revert <COMMIT>` con el árbol de trabajo protegido. No usar reset destructivo ni push forzado.
5. Ejecutar `npm run build` y comprobar Inicio, navegación de escritorio, menú móvil y Logística. Confirmar que el registro abre y permite volver a Logística.

Este cambio es independiente de `SHOW_EXTENDED_OPERATIONS` (Centro de operaciones) y `SHOW_PROGRESS_PHOTOS` (Mis obras). No cambiar esas constantes para reactivar Reportes o los accesos de compras.

## Movimiento de Herramientas dentro de Logística

Se agregó el acceso a Movimiento de Herramientas en el encabezado de Logística y un enlace de regreso en su página. Se ocultan su entrada en la navegación principal, en el menú móvil y la tarjeta principal de Inicio mediante `SHOW_TOOL_MOVEMENTS_SHORTCUT = false` en `src/config/navigationFeatures.ts`.

Logística se muestra para todos los perfiles que antes tenían el acceso a movimientos. Se conservan la ruta `/pedidos-herramientas`, las redirecciones, los enlaces de seguimiento y los retornos al finalizar operaciones. No cambian los datos ni permisos de la base.

Para recuperar los accesos principales, cambiar `SHOW_TOOL_MOVEMENTS_SHORTCUT` a `true`. Para deshacer toda esta reubicación, localizar el commit con `git log --oneline --grep="Mover Movimiento de Herramientas dentro de Logistica"`, revisar su diff y usar `git revert <COMMIT>` preservando los cambios posteriores. Validar con `npm run build`.
