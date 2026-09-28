export default async (request) => {
  const year = new URL(request.url).searchParams.get("year");
  if (!/^20\d{2}$/.test(year || ""))
    return new Response("Año inválido", { status: 400 });
  const source = `https://www.argentina.gob.ar/sites/default/files/holidays-${year}-es.json`;
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(8000) });
    if (!response.ok)
      return Response.json(
        { error: "Calendario oficial no disponible para este año" },
        { status: 404 },
      );
    const data = await response.json();
    if (!Array.isArray(data.mainEntity?.itemListElement))
      throw Error("Formato desconocido");
    const events = data.mainEntity.itemListElement.map(({ item }, i) => ({
      id: `ar-${year}-${i}`,
      title: item.name,
      date: item.startDate,
      kind: ["inamovible", "trasladable"].includes(
        item.additionalProperty?.value,
      )
        ? "feriado"
        : "no_laborable",
      description:
        item.additionalProperty?.value === "turistico"
          ? "Día no laborable con fines turísticos"
          : item.description +
            (/\([abc]\)/.test(item.name)
              ? " · Aplicación específica según comunidad; consultar fuente oficial."
              : ""),
      source: "https://www.argentina.gob.ar/feriados",
    }));
    return Response.json(
      { source, checkedAt: new Date().toISOString().slice(0, 10), events },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  } catch {
    return Response.json(
      { error: "No se pudo consultar el calendario oficial" },
      { status: 503 },
    );
  }
};
