import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({cacheDir:'scratch/vite-groups',server:{host:'127.0.0.1',port:0},plugins:[{name:'groups-fixture',configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
    if(!req.url?.startsWith('/herramientas')) return next();
    const html=(await readFile('index.html','utf8')).replace('/src/main.tsx','/tests/fixtures/tool-catalog.tsx');
    res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml(req.url,html));
  });
}}]});
let browser;
try {
  await server.listen();
  const {inventoryGroup}=await server.ssrLoadModule('/src/lib/inventoryGroups.ts');
  assert.equal(inventoryGroup({name:'Amoladora grande',category:'Amoladora › Diámetro por confirmar'}).key,'Amoladora:otras');
  assert.equal(inventoryGroup({name:'Cajón',category:'Cajón de herramientas › Metálico'}).key,inventoryGroup({name:'Cajón',category:'Cajón de herramientas › Material por confirmar'}).key);
  const rows=Array.from({length:12},(_,i)=>({id:'tool-'+i,code:'TEST-'+i,name:i<6?'Amoladora 7 pulgadas':i<8?'Amoladora chica':i<11?'Cajón de herramientas':'Amoladora grande',category:i<6?'Amoladora › 7 pulgadas':i<8?'Amoladora › 4 1/2 pulgadas':i<11?(i===8?'Cajón de herramientas › Metálico':'Cajón de herramientas › Material por confirmar'):'Amoladora › Diámetro por confirmar',brand:'Prueba',model:null,status:'En uso',current_obra_id:i%2?'obra-b':'obra-a',obras:{name:i%2?'Obra B':'Obra A',encargado_name:i%2?'Responsable B':'Responsable A'},photo_url:null}));
  browser=await chromium.launch({channel:'chrome',headless:true});
  const base=server.resolvedUrls.local[0];
  await mkdir('scratch/group-qa',{recursive:true});
  for(const width of [320,1280]) {
    const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(!url.pathname.startsWith('/rest/v1/'))return route.abort();
      let data=[];
      if(url.pathname.endsWith('/herramientas')){
        data=rows.filter(r=>!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+r.id);
        if(url.searchParams.get('select')==='photo_url')data={photo_url:null};
        else if(route.request().headers().accept?.includes('vnd.pgrst.object+json'))data=data[0];
      }
      await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(base+'herramientas');
    const groups=page.locator('[data-tool-groups]');await groups.waitFor();
    assert.equal(await groups.getByRole('button').count(),3);
    assert.match(await groups.getByRole('button').filter({hasText:'Otras amoladoras'}).innerText(),/3 unidades/);
    assert.equal(await page.locator('article').count(),0);
    const seven=groups.getByRole('button').filter({hasText:'Amoladora 7 pulgadas'});
    assert.match(await seven.innerText(),/6 unidades/);
    await page.screenshot({path:`scratch/group-qa/groups-${width}.png`,fullPage:true});
    await seven.click();
    assert.equal(await page.locator('article').count(),6);
    assert.match(await page.locator('article').first().innerText(),/Obra A.*Responsable A/s);
    await page.getByLabel('Obra actual',{exact:true}).selectOption('Obra B');
    assert.equal(await page.locator('article').count(),3);
    await page.reload();await page.locator('article').first().waitFor();
    assert.equal(await page.locator('article').count(),3);
    await page.getByLabel('Obra actual',{exact:true}).selectOption('');
    await page.getByRole('button',{name:'Ver ficha',exact:true}).first().click();
    await page.getByRole('button',{name:'Volver',exact:true}).waitFor();
    await page.getByRole('button',{name:'Volver',exact:true}).click();
    await page.locator('article').first().waitFor();
    assert.equal(await page.locator('article').count(),6);
    await page.getByRole('button',{name:'Volver a grupos',exact:true}).click();
    await groups.getByRole('button').filter({hasText:'Cajón de herramientas'}).click();
    assert.equal(await page.locator('article').count(),3);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`scratch/group-qa/units-${width}.png`,fullPage:true});
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS grouped cards, 6 seven-inch units, all boxes together, locations/responsibles, scope, reload, detail/back, 320px/desktop');
}finally{await browser?.close();await server.close();}
