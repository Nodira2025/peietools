# Agenda PEIE

Ruta: `/agenda`. Disponible desde el menú lateral y desde **Más → Agenda y cumpleaños** en móvil.

## Activación en producción

Aplicar `migracion_agenda.sql` en el proyecto indicado por `VITE_SUPABASE_URL` de este checkout, desde el editor SQL de Supabase con una sesión administradora. La migración crea solamente tablas y funciones de agenda; no cambia cuentas ni datos de solicitudes. Aplicada el 28/09/2026 en el proyecto kwgzivpokkhaeyrvhkbm. La prueba transaccional con rol authenticated verificó directorio, creación, edición, vínculos, lectura de avisos y borrado lógico; finalizó con ROLLBACK sin dejar datos de prueba.

Después de aplicarla, verificar con una cuenta activa de PEIE que `agenda_personas` y la lectura de `agenda_eventos` funcionan. Publicar el frontend y la función Netlify `feriados` y comprobar los archivos servidos. Sin la migración, el calendario de referencia funciona, pero el formulario queda deshabilitado con una explicación; no hay un falso guardado local.

## Comportamiento

- Calendario mensual y listado con filtros. Fechas y horas civiles de Argentina; no conversión UTC para los días.
- Feriados y días no laborables: fuente oficial `https://www.argentina.gob.ar/sites/default/files/holidays-{year}-es.json`, consultada desde una función Netlify con espera limitada y caché de una hora. Respaldo de 2026 consultado el 28/09/2026. La fuente puede incorporar cambios posteriores; la interfaz muestra fecha de consulta y fallos de actualización.
- Efemérides: selección con enlaces a fuentes, incluyendo energía eléctrica, construcción, Libro, Amigo, Maestro, Primavera, ahorro de energía, Tradición, Padre y Madre. Se distinguen de los feriados nacionales. No sustituye el convenio laboral ni el calendario provincial.
- Cumpleaños: solo día y mes. Al instalar, se importan los nacimientos existentes de `empleados_legajos` si esa tabla existe; no se devuelve el año de nacimiento. Administración y Logística pueden completar o quitar cumpleaños en Agenda. Esta información no altera el legajo privado y la importación inicial no sobrescribe correcciones de Agenda. Los días 29/2 se muestran en años bisiestos. Las personas sin fecha se cuentan, no se inventan cumpleaños.
- Se incluye personal activo y perfiles activos. No se fusionan registros por similitud de nombre ni se adivina qué cuenta corresponde a un electricista.
- Administración y Logística pueden administrar cualquier evento. Coordinadores y encargados pueden crear y editar/quitar sus propios eventos. Otros usuarios activos pueden consultar. Las reglas se aplican en PostgreSQL; se rechaza el acceso anónimo.
- Vincular personas es opcional y no implica avisar. La casilla de avisos crea avisos PEIE para los perfiles vinculados. Los empleados sin cuenta reciben el mensaje mediante el botón opcional de WhatsApp; el usuario revisa y lo envía en WhatsApp. Abrir el mensaje no se registra como entrega ni lectura. No hay push nativo ni envío automático por WhatsApp.
- Las notificaciones aparecen en el Centro de Notificaciones y se suman a la campana. Se pueden marcar como leídas desde el evento. Al editar hay que volver a marcar la opción si se desea un nuevo aviso.
- Evento y vínculos se guardan en una única transacción; errores no dejan vínculos parciales. El borrador conserva su UUID para que reintentar una creación no duplique el evento. Quitar eventos hace borrado lógico.
- Los feriados/efemérides son referencias de lectura; se pueden ocultar con filtros. Los eventos propios son editables.

## Validación local

- `node tests/agenda-sql.mjs`: PostgreSQL embebido (PGlite), migración, permisos, escritura atómica, días inválidos, lectura de avisos, borrado lógico y acceso anónimo.
- `node tests/agenda-dates.mjs`: calendario, años bisiestos, domingos variables, formato de fechas, clasificación de no laborables y validación de la función Netlify.
- `node tests/agenda.mjs`: componentes reales con API de prueba, 390/1280 px, crear/editar/quitar, selección múltiple, WhatsApp preparado sin enviarlo, avisos, cumpleaños y falla de servidor. No crea eventos ni envía mensajes reales.
- `npm run build`; ESLint dirigido a los archivos nuevos. El proyecto mantiene errores TypeScript anteriores en otras secciones; comprobar el registro de diagnósticos al repetir la revisión.

