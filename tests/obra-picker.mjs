import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ cacheDir:'scratch/vite-obra-picker', server:{host:'127.0.0.1',port:0}, plugins:[{name:'fixture',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(!req.url.startsWith('/herramientas/nueva'))return next();try{const html=(await readFile('index.html','utf8')).replace('/src/main.tsx','/tests/fixtures/tool-catalog.tsx');res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml(req.url,html));}catch(e){next(e);}});}}]});
let browser;
try {
 await server.listen(); browser=await chromium.launch({channel:'chrome',headless:true});
 const base=server.resolvedUrls.local[0];
 for(const width of [390,1280]) {
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let mode='error';
  await page.addInitScript(()=>sessionStorage.setItem('draft_nueva_herramienta',JSON.stringify({name:'Taladro de prueba',code:'TEST-1',wizardStep:'obra'})));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin===new URL(base).origin)return route.continue();
   if(!u.pathname.startsWith('/rest/v1/'))return route.abort();
   if(u.pathname.endsWith('/obras')) {
    assert.equal(u.searchParams.get('select'),'id,name');
    if(mode==='stall')return;
    if(mode==='error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Unavailable'})});
    return route.fulfill({contentType:'application/json',body:JSON.stringify(mode==='empty'?[]:[{id:'obra-1',name:'ONE RESIDENCE'}])});
   }
   return route.fulfill({contentType:'application/json',body:'[]'});
  });
  await page.goto(base+'herramientas/nueva');
  await page.getByRole('alert').filter({hasText:'No se pudieron cargar las obras'}).waitFor();
  mode='empty';await page.getByRole('button',{name:'Reintentar carga de obras'}).click();
  await page.getByText(/No hay obras activas disponibles/).waitFor();
  mode='stall';await page.getByRole('button',{name:'Reintentar carga de obras'}).click();
  await page.getByText('Cargando obras…',{exact:true}).waitFor();
  await page.getByRole('alert').filter({hasText:'demoró demasiado'}).waitFor({timeout:22000});
  mode='ok';await page.getByRole('button',{name:'Reintentar carga de obras'}).click();
  if(width===390){await page.getByRole('button',{name:'ONE RESIDENCE'}).click();await page.getByText('¿Querés agregar una foto?').waitFor();}
  else {await page.getByRole('combobox').last().click();await page.getByRole('option',{name:'ONE RESIDENCE'}).click();}
  const draft=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('draft_nueva_herramienta')));
  assert.equal(draft.name,'Taladro de prueba');assert.equal(draft.code,'TEST-1');assert.equal(draft.currentObraId,'obra-1');
  assert.deepEqual(errors,[]);
  await mkdir('scratch/obra-picker',{recursive:true});await page.screenshot({path:`scratch/obra-picker/${width}.png`});
  await page.close();console.log(`PASS ${width}px: server error, empty response, timeout, retry, selection, draft preserved`);
 }
} finally {await browser?.close();await server.close();}
