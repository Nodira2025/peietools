# Centro de operaciones: vista de personal y herramientas y guía de reversión

## Pedido y alcance aprobado

La empresa solicitó mostrar por ahora solamente personal y herramientas asignados a cada obra. También pidió que los indicadores del mapa correspondan a las ubicaciones y tengan contexto geográfico. El usuario confirmó el alcance antes de implementar.

Se mantienen nombre, dirección, coordinador, estado y accesos a la obra como contexto para identificar los recursos. Se ocultan costos, horas, valuaciones, porcentajes de avance, índice de carga, alertas, sugerencias y buscador de cercanía. El buscador por nombre de obra, persona o herramienta y el filtro de coordinador siguen disponibles. Los chips de capas se ocultan porque no controlaban las capas del mapa.

## Implementación

- `src/components/operations/operationsFeatures.ts`: `SHOW_EXTENDED_OPERATIONS = false` controla las funciones ampliadas. `hasStoredCoordinates` valida números finitos y rangos compatibles con el mapa; rechaza el par 0,0.
- `src/pages/CentroOperaciones.tsx`: evita consultar novedades diarias y leer avances o tarifas locales en esta vista. Los dos indicadores cuentan las asignaciones de las obras que coinciden con los filtros, no todo el inventario ni personas sin obra. La búsqueda y selección no centran el mapa sobre ubicaciones referenciales.
- `src/components/operations/OperationsKPIs.tsx`: muestra personal y herramientas en obras.
- `src/components/operations/OperationsSidebar.tsx`: conserva las pestañas de personal y herramientas; oculta métricas ampliadas. Todas las obras filtradas están disponibles en el listado, incluidas las que no tienen coordenadas.
- `src/components/operations/worksiteBubble.ts`: indicadores compactos con nombre, dos cantidades y un punto de anclaje. El resumen emergente muestra dirección y recursos. Las etiquetas se insertan como texto, no como HTML.
- `src/components/operations/OperationsMap.tsx`: mantiene el fondo de calles de OpenStreetMap; ubica el punto del indicador en la coordenada guardada, ajusta el encuadre a las obras y permite volver a verlas todas. No desplaza coordenadas para separar indicadores. Ante errores del mapa, oculta los indicadores y muestra un mensaje con reintento, evitando dejar burbujas sobre un fondo vacío.
- `src/components/operations/OperationsFilters.tsx`: conserva búsqueda y coordinador.
- `tests/operations-summary.mjs`: verifica el alcance en escritorio y móvil, ausencia de consultas de costos, contenidos, obras sin ubicación y navegación a herramientas.

## Ubicaciones: limitaciones y mantenimiento

El resolvedor anterior (`src/services/geo/tucumanGeoRegistry.ts`) contiene ubicaciones por coincidencia de nombres y una dispersión artificial basada en el ID. Se conserva en el repositorio, pero ya no participa en la carga del Centro: las coordenadas se copian directamente de Obras y se conservan como null si faltan. Solo presenta obras con coordenadas válidas guardadas en la base.

Validar formato no demuestra que la coordenada corresponda a la dirección real. Este cambio no geocodifica ni corrige registros en Supabase. Las coordenadas faltantes o incorrectas deben confirmarse con la empresa y cargarse en la obra. No inventar ubicaciones ni copiar puntos del registro por similitud de nombre. Las obras sin coordenadas siguen siendo consultables en el listado y su enlace a Google Maps busca por dirección o nombre.

Obras distintas con la misma coordenada pueden superponer indicadores; siguen siendo accesibles en el listado. No separarlas alterando su ubicación real. El mapa necesita conexión al proveedor de calles.

## Cómo recuperar las funciones ampliadas conservando las mejoras del mapa

1. Leer este documento y revisar `git status` para preservar cambios ajenos.
2. En `src/components/operations/operationsFeatures.ts`, cambiar `SHOW_EXTENDED_OPERATIONS` de `false` a `true`.
3. Esto vuelve a habilitar los componentes conservados: costos, horas, valuaciones, avance, índice, sugerencias, buscador de cercanía y chips; también las consultas y lecturas locales necesarias. Las burbujas recuperan su visualización anterior de avance.
4. Se mantienen las mejoras geográficas: exclusión de coordenadas referenciales, encuadre, listado completo de obras sin ubicación y manejo de error del mapa. Los totales de personal y herramientas siguen basados en las obras filtradas.
5. Revisar el buscador de cercanía antes de volver a utilizarlo: su lógica antigua admite coordenadas referenciales. Activar funciones ampliadas no convierte esas referencias en ubicaciones verificadas.
6. Ejecutar `npm run build`. Adaptar las expectativas de `tests/operations-summary.mjs` si se habilitan métricas, porque actualmente exige que estén ocultas. La versión anterior del test está en el commit base indicado abajo.
7. Revisar visualmente escritorio y móvil; luego crear un commit y subirlo si la tarea lo autoriza.

No es necesario borrar o migrar datos. Las fotos, avances, precios y registros existentes se conservan. Los datos manuales de avance y precios dependen del almacenamiento del navegador, como antes.

## Cómo deshacer completamente este cambio

Base anterior: `c033d1b` (ya contiene el ocultamiento del registro fotográfico en Mis obras).

Localizar el commit de esta implementación:

```sh
git log --oneline --grep="Limitar Centro de operaciones a personal y herramientas"
git show --stat <COMMIT_ENCONTRADO>
```

Con el árbol de trabajo protegido y revisado, ejecutar `git revert <COMMIT_ENCONTRADO>`. Resolver conflictos comparando el alcance anterior; no sobrescribir cambios posteriores. Esto crea un commit inverso y también revierte esta documentación y el test actualizado. No usar `git reset --hard` ni forzar el push.

Si solo se necesita recuperar un archivo, comparar primero `git diff c033d1b -- <ruta>` y recuperar únicamente los fragmentos deseados. No restaurar todo el repositorio.

## Cambio anterior independiente: fotos en Mis obras

En `src/pages/MisObras.tsx`, `SHOW_PROGRESS_PHOTOS = false` oculta el registro fotográfico, su diálogo y vista previa, y evita consultar las fotos. Para recuperarlo, cambiar esa constante a `true`. Es independiente de `SHOW_EXTENDED_OPERATIONS` y del cambio documentado aquí. Commit: `c033d1b`.

## Validación

- `npm run build`: compilación de producción.
- `node tests/operations-summary.mjs`: prueba con datos y teselas simulados, sin escribir en Supabase.
- En PowerShell, `$env:OPERATIONS_REAL_TILES='1'; node tests/operations-summary.mjs`: datos simulados con calles reales de OpenStreetMap para revisión visual. Requiere conexión.
- Escritorio de 1280 px y móvil de 390 px; capturas en `scratch/operations-qa/` (no versionadas).

Los tests no verifican la exactitud física de ubicaciones de producción ni se conectan a datos reales de la empresa.

## Corrección del filtro de encargados (14/09/2026)

Se confirmó por lectura de `obras.encargado_name` que había variantes como Carlos Grande, CARLOS GRANDE, Carlos, Carlos con espacio final, Martin Grande y Martin.

`src/services/operations/coordinatorDirectory.ts` normaliza espacios, mayúsculas y tildes para generar una opción por encargado. Un nombre corto se agrupa con el completo solo cuando existe una única coincidencia por primer nombre. Si aparecen Carlos Grande y Carlos Perez, Carlos permanece separado para no mezclar personas sin evidencia suficiente. No se realizan correcciones ortográficas aproximadas ni cambios en Supabase.

El selector usa una clave normalizada y aplica la misma resolución a cada obra; así incluye las obras registradas con variantes del nombre. La búsqueda también reconoce el nombre completo para obras cargadas con nombre corto. La ficha seleccionada se oculta si queda fuera del filtro.

La prueba `tests/operations-summary.mjs` cubre duplicados, abreviaciones únicas, nombres ambiguos y filtrado en escritorio y móvil. Para deshacer solo esta corrección, localizar el commit con `git log --oneline --grep="Unificar encargados duplicados en Centro de operaciones"` y revertirlo tras revisar cambios posteriores; no cambiar el indicador de funciones ampliadas.


## Consistencia con Obras (14/09/2026)

Se revisó por lectura la tabla `obras`: 31 registros; 14 con coordenadas guardadas y 17 sin coordenadas. Ambas páginas consultan esta misma tabla. El alcance es igualdad con la información registrada en Obras, no una verificación física de cada dirección.

- Centro de operaciones conserva directamente latitude y longitude de la obra, incluidos los null. Se elimina el uso de resolveWorksiteCoordinates en esa página, sin generar coordenadas por nombre ni por ID.
- Nombre, dirección, encargado, teléfono y estado proceden del mismo registro. El ID relaciona el personal y las herramientas con la obra.
- Obras y el mapa comparten la validación de coordenadas; editar una coordenada con valor cero conserva el número.
- La ficha del Centro muestra las coordenadas guardadas y usa “Sin dirección” cuando falta la dirección.
- Al recuperar el foco se vuelven a consultar los registros. Se escucha Supabase Realtime para cambios en obras, empleados y herramientas (requiere que la publicación Realtime del servidor esté habilitada). Se descartan respuestas antiguas y posteriores al desmontaje.
- Los módulos ampliados conservados verifican coordenadas antes de usarlas para distancias.

Las pruebas de escritorio y móvil comprueban que una respuesta actualizada de Obras cambia nombre, dirección y coordenadas del Centro al recuperar el foco, sin escribir datos reales. La compilación de producción pasa. La comprobación global TypeScript tiene errores existentes en otros módulos y no sirve como validación global aprobada.

Para deshacer solo esta revisión, localizar el commit con `git log --oneline --grep="Sincronizar ubicaciones del Centro con Obras"` y revisar su diff antes de aplicar `git revert` al commit. No restaurar datos de la base ni inventar coordenadas para las obras pendientes.
