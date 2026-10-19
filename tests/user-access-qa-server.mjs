import { createServer } from 'vite';
const port = 5198;
const server = await createServer({
  cacheDir:'scratch/vite-user-access-qa',
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(`http://127.0.0.1:${port}`),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('qa-local-only')},
  server:{host:'127.0.0.1',port,strictPort:true},
  plugins:[{name:'user-access-qa',configureServer(server){
    server.middlewares.use(async(req,res,next)=>{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/qa/')||url.pathname==='/bienvenida'){
        res.setHeader('Content-Type','text/html');
        res.end(await server.transformIndexHtml(url.pathname,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/user-access.tsx"></script></body></html>'));return;
      }
      if(url.pathname.startsWith('/auth/')||url.pathname.startsWith('/rest/')||url.pathname.startsWith('/realtime/')){
        res.statusCode=400;res.end('QA: unexpected request');return;
      }
      next();
    });
  }}],
});
await server.listen();console.log(`QA aislado: http://127.0.0.1:${port}/qa/usuarios`);
