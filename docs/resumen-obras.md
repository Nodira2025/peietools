# Centro de Operaciones: avance y resumen de obras

Cada burbuja muestra el avance registrado de 0 a 100%. El anillo se completa en verde al llegar al 100%; un avance desconocido se muestra como «Sin datos». Se lee el estado manual de Coordinadores sin generar ni usar sus estados de muestra.

Al pasar el puntero o enfocar con el teclado se muestran trabajadores asignados, horas registradas, herramientas actualmente asignadas, su valor, costo por horas y finalización. Al tocar la burbuja se abre la ficha con las mismas métricas.

El valor global incluye todo el inventario. El valor por obra incluye las herramientas actualmente asignadas, no todas las que pasaron históricamente por ella ni alquileres. Se reutiliza el precio manual de cada ficha; cuando falta, se usa la estimación del servicio de precios existente y se informa cuántos valores son estimados. No se suman reparaciones ni se consultan cotizaciones en vivo.

Las horas se atribuyen por la obra indicada en la novedad. Si falta el ID se intenta el nombre de obra. No se trasladan horas antiguas a la ubicación actual del empleado. Registros sin obra no se asignan por suposición. El costo es horas registradas por tarifa individual; si falta se usa la tarifa de respaldo por especialidad y se indican las horas estimadas. No equivale a una liquidación salarial: no incluye cargas sociales ni adicionales.

Limitación existente: Coordinadores y precios manuales usan almacenamiento del navegador. Esos datos no están sincronizados entre personas o dispositivos. La interfaz informa esta limitación. No se modificó la base de datos ni se generaron porcentajes reales automáticamente.

Validación: `node tests/operations-summary.mjs` prueba la página y el mapa reales con datos ficticios, 65%, 100%, ausencia de datos, navegación, resúmenes, precios, atribución de horas y paginación en escritorio y celular. Todas las solicitudes externas están interceptadas. `npm run build` verifica la compilación.
