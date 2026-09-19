# Logística PEIE: contexto operativo y verificación

## Objetivo acordado

Digitalizar pedidos y movimientos de herramientas y electricistas entre obras, depósitos y camionetas. Mantener el producto sencillo: catálogo, disponibilidad, origen, destino, responsable y registro del movimiento.

Coordinación o Administración pide una herramienta para una obra y una fecha. Logística toma el pedido, elige una unidad disponible, consulta dónde retirarla, registra el traslado y la entrega. Una herramienta en uso requiere liberación antes del retiro; liberar no significa que cambió de ubicación física.

El personal también puede trasladarse por Logística o ser asignado directamente por Administración cuando el viaje se organiza fuera de la app. Deben conservarse categoría, estado, obra e historial. Ausencia, licencia y traslado no deben confundirse con disponibilidad.

Los reportes registran compras o tareas que exceden a Logística para su seguimiento administrativo. Compartir por WhatsApp es complementario al guardado. Mis Obras debe permitir consultar recursos y fotos desde el celular.

## Diagnóstico y cambios

- Centro de Operaciones: la consulta de 82 herramientas incluyendo `photo_url` falla con PostgreSQL `57014` (statement timeout). Solo diez fotos sumaban 15.398.807 caracteres. Consultar las mismas herramientas sin fotos respondió en 0,6 segundos.
- Centro y Mis Obras cargan listas livianas; las fotos se solicitan individualmente cuando se muestran. Se reutiliza el componente de fotos también para empleados.
- El Centro informa una carga parcial y mantiene las obras si falla personal o herramientas. Una falla de obras sigue mostrando error y reintento.
- Una herramienta en uso ya no se ofrece como disponible en el asistente. Se verifica el estado al iniciar el traslado y no se permite trasladar un pedido sin unidad asignada.
- Liberar una herramienta conserva la ubicación de retiro. El historial usa la obra de origen del pedido, no la ubicación actual de la herramienta.
- El catálogo de personal conserva estados distintos de Trabajando/Libre. Editar datos básicos sin cambiar la obra no sobrescribe su estado. El formulario de traslado consulta estado y actividad, bloquea ausentes/inactivos/en traslado y evita el doble envío durante el guardado.
- Reportar Tarea espera el resultado del guardado, conserva el texto ante error y ofrece WhatsApp después. El estado inicial es Pendiente; abrir un enlace no demuestra que se haya enviado un mensaje. Administración y Logística vuelven a tener acceso a Reportes.
- Los errores de historial o sincronización de herramientas se muestran como movimientos incompletos, en vez de confirmar un éxito completo.
- Al habilitar Reportes se retiraron dos gráficos con cifras de ejemplo, se aligeró su consulta de inventario y se corrigió la llamada al exportador PDF. El historial administrativo queda accesible sin presentar esos ejemplos como cifras reales.

## Pruebas realizadas

Las escrituras funcionales se efectuaron en un backend local en memoria, con nombres QA. No se crearon pedidos reales ni se enviaron mensajes. El servidor se inicia con `node tests/logistics-qa-server.mjs`; reemplaza la conexión Supabase por localhost. El cliente de prueba bloquea `window.open`.

| Recorrido | Evidencia |
| --- | --- |
| Centro, escritorio | Tres obras de prueba con marcadores y totales |
| Centro, móvil | Mapa y listado; al simular fallo de herramientas conserva obras y avisa totales incompletos |
| Pedido de herramienta, escritorio | Selección de unidad y destino, inserción del pedido, aceptación, traslado y entrega con código |
| Pedido, móvil | Nombre/familia, fecha, obra y confirmación; aparece en Logística como pendiente de unidad |
| Disponibilidad | Herramienta en uso requiere liberación; herramienta rota no se ofrece como disponible |
| Personal, móvil | Asignación directa de un operario libre; obra y traslado confirmado persistidos |
| Personal, escritorio | Coordinador solicita traslado de operario ocupado; queda pendiente y en traslado; Logística confirma recepción |
| Personal | Ausente se conserva como Ausente en el catálogo |
| Mis Obras, móvil | Recursos asignados aparecen en su destino después de las operaciones QA |
| Reportes | Fallo simulado conserva formulario y no abre WhatsApp; recuperación permite guardar |
| Contactos, escritorio | Directorio y acciones disponibles; sin enviar mensajes |
| Datos reales, solo lectura | 31 obras, 38 empleados, 82 herramientas; consultas livianas exitosas (515–563 ms en una medición) |

Viewport móvil solicitado: 390×844; Chrome expuso un ancho efectivo de 433 px. Escritorio solicitado: 1280×900. Son pruebas responsive en navegador, no pruebas en un teléfono físico.

El build de producción pasa. La prueba de taxonomía pasa. El chequeo TypeScript global presenta deuda previa en módulos como liquidación, reportes y coordinadores; no equivale a una certificación de ausencia de errores en toda la aplicación.

## Recomendaciones de continuidad

1. Hacer atómicos los movimientos en Supabase: solicitud, recurso e historial deben guardarse dentro de una transacción, con controles de concurrencia. El aviso de movimiento incompleto no sustituye esa garantía.
2. Separar explícitamente disponibilidad y ubicación de personal, incluyendo ausencia/licencia con fechas. La base actual tiene estados históricos y usa también obras de ausencia; definir un único modelo antes de migrar.
3. Implementar rutas por tiempo de viaje desde Logística, pasando por el retiro y llegando al destino. El asistente actual usa distancia geográfica al destino; no consulta tránsito ni tiempo de ruta.
4. Completar reservas futuras con liberación comprometida y conflictos por fecha. El pedido registra fecha de necesidad; eso no garantiza por sí solo una reserva ni que otra obra libere el recurso.
5. Llevar las fotos históricas a almacenamiento de archivos con miniaturas, conservando respaldo y relaciones. La carga individual resuelve el bloqueo de listas, pero las fotos originales siguen siendo grandes.
6. Unificar reportes y compras en una bandeja administrativa con pendiente, aprobado, resuelto y responsable. El reporte actual no se convierte automáticamente en una orden de compra.
7. Definir notificaciones internas para todos los coordinadores y Logística. No confundir una plantilla WhatsApp con entrega automática o lectura confirmada.

No se migraron datos, no se modificaron permisos y no se añadieron servicios de rutas ni mensajería automática en esta actualización.
