# Tareas, electricistas y costos por obra

En Coordinadores → Avance de obras, el bloque «Equipo, tareas y costos de obra» conserva el coordinador existente. Cada tarea pertenece a una fase guardada y a su obra. Las asignaciones guardan los identificadores de empleados y herramientas; los nombres se muestran desde sus registros.

## Activación

Aplicar el contenido completo de `migracion_tareas_costos_obra.sql` en Supabase. Requiere las tablas base `obras`, `empleados` y `herramientas`; crea `obra_fases` y `liquidaciones_sueldos` si faltan y agrega las columnas de tarifa del empleado. No es necesario ejecutar antes las migraciones de fases y liquidaciones. Las tablas existentes conservan sus datos y políticas. No se insertan fases ni sueldos de muestra. La búsqueda de DNI utiliza `empleados_legajos` y respeta sus permisos existentes (administración/logística). La migración no cambia coordinadores, ubicaciones, sueldos ni registros de asistencia. Las tablas nuevas permiten acceso a usuarios autenticados, siguiendo el módulo de fases.

El script es transaccional e idempotente. No se ejecutó sobre la base remota durante esta implementación. Si falta una tabla o falla una consulta, se muestra el error y un botón para reintentar; no se presenta un total cero como si fuera un resultado válido.

## Uso y cálculo

1. Crear una tarea dentro de una fase guardada, o editarla.
2. Escribir nombre o DNI y seleccionar uno o más electricistas. Se ignoran acentos al buscar nombres y separadores al buscar DNI. Personal asignado a tareas también aparece en el equipo de la obra, aunque tenga otra ubicación actual.
3. Indicar horas dedicadas a la tarea. La categoría inicial proviene de la especialidad del empleado; se puede ajustar. La tarifa inicial proviene de `empleados.valor_hora` y puede completarse manualmente.
4. Alternativamente, seleccionar una liquidación APROBADA o PAGADA con horas. La tarifa se calcula como `(sueldo_bruto + bono_presentismo) / horas_trabajadas`, redondeada a dos decimales. No se vuelve a sumar el sueldo completo ni el neto. El servidor verifica el empleado y el límite de horas entre todas las tareas y obras.
5. Seleccionar herramientas y registrar concepto/unidad, cantidad y costo unitario. Puede imputarse alquiler, uso, amortización o una porción de compra. No se copia automáticamente el valor total de inventario ni los precios estimados locales. La herramienta conserva su ubicación.

Cada renglón de costo se redondea a centavos. El total de tarea es mano de obra más herramientas; fase y obra suman las tareas una sola vez. El avance de tarea es independiente del avance manual de fase del cronograma.

Son costos imputados, no precio de venta ni comprobación de dinero pagado. No incluyen otros gastos, cargas o márgenes no cargados. Las horas de asistencia no se distribuyen automáticamente entre tareas: el usuario debe indicar dónde se consumieron. Las liquidaciones disponibles son las persistidas en `liquidaciones_sueldos`; una proyección local no se presenta como liquidación cerrada. Las tarifas y categorías manuales quedan como valores históricos de la tarea; al guardar nuevamente una tarea con liquidación se recalcula esa tarifa desde el registro de origen.

La escritura de tarea y recursos es atómica. Las referencias impiden borrar fases con tareas o recursos que tienen imputaciones. Para eliminar una fase hay que reasignar o eliminar sus tareas primero.

## Verificación

- `npm run build`
- `node tests/obra-costos.mjs` (Playwright; para navegador instalado, establecer `PLAYWRIGHT_CHANNEL=msedge` o `chrome`). Prueba búsqueda, creación, cálculo, recarga, error y eliminación a 390 y 1440 px con API simulada.
- `npm install --prefix scratch/sql-qa --no-audit --no-fund @electric-sql/pglite`, luego `node tests/obra-costos-sql.mjs`. Prueba la migración en PostgreSQL embebido, idempotencia, cálculo de tarifa, límite entre obras, reversión y restricciones.

El chequeo TypeScript global presenta errores previos en otros módulos; la compilación Vite y el lint de los archivos nuevos pasan.
