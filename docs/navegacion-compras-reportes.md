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

## Acceso directo para pedir herramientas

Se agrega “Pedir herramientas” inmediatamente debajo de “Herramientas” en `mainNavTop` de `src/layouts/AppLayout.tsx`. Abre el formulario existente `/solicitudes/nueva` y está disponible para los mismos perfiles que ven Herramientas. El historial Movimiento de Herramientas permanece dentro de Logística.

Para retirar únicamente este acceso, eliminar la entrada con `path: '/solicitudes/nueva'` de `mainNavTop`. No eliminar la ruta ni el formulario.

## Reportar Tarea reemplaza a Reportar Compra en Logística

Cambio aplicado tras aprobar la vista previa: el encabezado de Logística mantiene Movimiento de Herramientas y Registro de Compras, y ofrece Reportar Tarea en lugar de Reportar Compra.

- `SHOW_REPORT_PURCHASE = false` en `src/config/navigationFeatures.ts` oculta el diálogo completo de Reportar Compra en Logística, su acceso en Inicio y la apertura mediante `?nuevaCompra=true`. La función y los datos de compras se conservan.
- `src/components/ReportTaskDialog.tsx` contiene el formulario de tarea existente, compartido por Inicio y Logística. Sus listas de personas se cargan al abrirlo. Se conserva la selección de destinatario, personal de obra/oficina, tarea, motivo y apertura de WhatsApp por acción del usuario.
- El formulario comprueba que el destinatario elegido tenga WhatsApp; no interpreta un ID de usuario como teléfono. Para personal de la tabla empleados conserva el nombre en el reporte y no envía ese ID a la clave foránea de usuarios de autenticación.
- La opción Reportes continúa oculta; no se reactiva el módulo de informes.

Para volver a mostrar Reportar Compra, cambiar `SHOW_REPORT_PURCHASE` a `true`. Para revertir todo el reemplazo y la extracción del formulario compartido, localizar el commit con `git log --oneline --grep="Reemplazar Reportar Compra por Reportar Tarea en Logistica"`, revisar sus cambios y revertir ese commit preservando modificaciones posteriores.

Validación: `npm run build` y `node tests/logistica-report-task.mjs`. Se comprueban escritorio de 1280 px y móvil de 390 px, el formulario desde Logística e Inicio, el bloqueo del enlace antiguo y la conservación del Registro de Compras. Las pruebas usan datos simulados y no generan reportes ni abren WhatsApp.
