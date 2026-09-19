// Local-only functional QA backend. No production credentials or writes.
import { createServer } from 'vite';
const port = 5187;
const db = {
  obras: [
    { id: 'obra-a', name: 'Depósito QA', latitude: -26.83, longitude: -65.22 },
    { id: 'obra-b', name: 'Obra Norte QA', latitude: -26.81, longitude: -65.21 },
    { id: 'obra-c', name: 'Camioneta QA', latitude: -26.85, longitude: -65.24 },
  ].map(x => ({ ...x, active: true, encargado_name: 'Coordinador QA', status: 'Activa', address: 'Dirección de prueba' })),
  herramientas: [
    { id: 'tool-a', code: 'AM-QA-1', status: 'Disponible', current_obra_id: 'obra-a' },
    { id: 'tool-b', code: 'AM-QA-2', status: 'En uso', current_obra_id: 'obra-b' },
    { id: 'tool-c', code: 'AM-QA-3', status: 'Rota', current_obra_id: 'obra-c' },
  ].map(x => ({ ...x, name: 'Amoladora 7 pulgadas', category: 'Amoladora › 7 pulgadas', brand: 'QA', model: '7', photo_url: null })),
  empleados: [
    { id: 'emp-a', full_name: 'Operario Libre QA', obra_id: null, status: 'Libre' },
    { id: 'emp-b', full_name: 'Operario Ocupado QA', obra_id: 'obra-a', status: 'Trabajando' },
    { id: 'emp-c', full_name: 'Operario Ausente QA', obra_id: 'obra-b', status: 'Ausente' },
  ].map(x => ({ ...x, specialty: 'Oficial', active: true, photo_url: null, whatsapp: null, valor_hora: 4800 })),
  profiles: [
    { id: 'test-user', full_name: 'Coordinador QA', role: 'admin' },
    { id: 'log-user', full_name: 'Logística QA', role: 'logistica' },
  ].map(x => ({ ...x, active: true, whatsapp: null })),
  solicitudes: [], traslados_personal: [], movimientos: [], reportes_excedidos: [],
  categorias_herramientas: [{ id: 'cat-a', name: 'Amoladora › 7 pulgadas' }],
};
let sequence = 0;
const writes = [];
let failTable = '';
function matches(row, params) {
  return [...params].every(([key, expr]) => {
    if (['select','order','limit','offset','or'].includes(key)) return true;
    if (expr.startsWith('eq.')) return String(row[key]) === expr.slice(3);
    if (expr.startsWith('neq.')) return String(row[key]) !== expr.slice(4);
    if (expr.startsWith('in.(')) return expr.slice(4,-1).split(',').map(x=>x.replaceAll('"','')).includes(String(row[key]));
    if (expr === 'not.is.null') return row[key] != null;
    if (expr === 'is.null') return row[key] == null;
    return true;
  });
}
function joined(row) {
  return { ...row,
    obras: db.obras.find(x=>x.id===(row.current_obra_id || row.obra_id)) || null,
    herramientas: row.herramienta_id ? joined(db.herramientas.find(x=>x.id===row.herramienta_id) || {}) : null,
    empleados: db.empleados.find(x=>x.id===row.empleado_id) || null,
    source_obra: db.obras.find(x=>x.id===row.source_obra_id) || null,
    target_obra: db.obras.find(x=>x.id===row.target_obra_id) || null,
    profiles: db.profiles.find(x=>x.id===row.requester_id) || null,
    requester: db.profiles.find(x=>x.id===row.requester_id) || null,
  };
}
const server = await createServer({
  cacheDir: 'scratch/vite-logistics-qa',
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(`http://127.0.0.1:${port}`), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('qa-local-only') },
  server: { host: '127.0.0.1', port, strictPort: true },
  plugins: [{ name: 'local-logistics-qa', configureServer(server) {
    server.middlewares.use(async(req,res,next)=>{
      const url = new URL(req.url,'http://localhost');
      const json = (data,status=200) => { res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data)); };
      if (url.pathname==='/__qa/state') return json({db,writes,failTable});
      if (url.pathname==='/__qa/fail') { failTable=url.searchParams.get('table')||'';return json({failTable}); }
      if (url.pathname.startsWith('/rest/v1/')) {
        const table=url.pathname.split('/').at(-1);
        if(table===failTable) return json({code:'QA_FAILURE',message:'Falla de prueba'},500);
        let rows=(db[table]||[]).filter(row=>matches(row,url.searchParams));
        if (req.method==='POST'||req.method==='PATCH') {
          let raw=''; for await(const part of req) raw+=part;
          const payload=JSON.parse(raw||'{}');
          writes.push({table,method:req.method,payload});
          if(req.method==='POST') { rows=(Array.isArray(payload)?payload:[payload]).map(x=>({...x,id:`qa-${++sequence}`,created_at:new Date().toISOString()}));(db[table]??=[]).push(...rows); }
          else rows.forEach(x=>Object.assign(x,payload));
        }
        const offset=Number(url.searchParams.get('offset')||0), limit=Number(url.searchParams.get('limit')||1000);
        const count=rows.length;rows=rows.slice(offset,offset+limit).map(joined);
        res.setHeader('Content-Range',`${offset}-${Math.max(offset,offset+rows.length-1)}/${count}`);
        if(req.headers.accept?.includes('vnd.pgrst.object')) return rows.length ? json(rows[0]) : json({code:'PGRST116',details:'The result contains 0 rows'},406);
        return json(rows);
      }
      if(url.pathname.startsWith('/auth/')||url.pathname.startsWith('/realtime/')) return json({});
      if(!url.pathname.includes('.')&&!url.pathname.startsWith('/@')&&!url.pathname.startsWith('/src/')&&!url.pathname.startsWith('/node_modules/')) {
        const html='<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/logistics-qa.tsx"></script></body></html>';
        res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml(url.pathname,html));return;
      }
      next();
    });
  }}],
});
await server.listen(); console.log(`QA isolated at http://127.0.0.1:${port}`);
