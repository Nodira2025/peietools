// Real page components with synthetic inventory. Every external request is intercepted.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import XLSX from 'xlsx';

const server = await createServer({
  cacheDir:'scratch/vite-catalog-test',
  server:{host:'127.0.0.1',port:0},
  optimizeDeps:{entries:['tests/fixtures/tool-catalog.tsx']},
  plugins:[{name:'tool-catalog-regression',configureServer(server){
    server.middlewares.use(async(req,res,next)=>{
      if (!/^\/(?:__tool-catalog|herramientas(?:\/[^?]*)?|solicitudes\/nueva)(?:\?|$)/.test(req.url)) return next();
      try {
        const html=(await readFile('index.html','utf8')).replace('/src/main.tsx','/tests/fixtures/tool-catalog.tsx');
        res.setHeader('Content-Type','text/html');
        res.end(await server.transformIndexHtml('/__tool-catalog',html));
      } catch(error){next(error);}
    });
  }}],
});
let browser;
try {
  await server.listen();
  browser=await chromium.launch({channel:'chrome',headless:true});
  const base=server.resolvedUrls.local[0];
  const inventory=[
    {id:'ladder-eight',code:'ESC-08',name:'Escalera 8p',category:'Escalera 8p',brand:'EGP',model:'8 peldaños',status:'Disponible'},
    {id:'ladder-two',code:'ESC-02',name:'Escalera chica',category:'Escalera › 2 peldaños',brand:null,model:null,status:'En uso'},
    {id:'ladder-twelve',code:'ESC-12',name:'Escalera 12 peldaños',category:'Escaleras',brand:null,model:null,status:'Disponible'},
    {id:'ladder-unknown',code:'ESC-03',name:'Escalera 3',category:'Escaleras',brand:'Cant peldaños',model:null,status:'Disponible'},
    {id:'grinder',code:'AM-750',name:'Amoladora chica 750W',category:'Amoladora (4 1/2")',brand:'Total',model:'750W',status:'Disponible'},
  ].map(t=>({...t,current_obra_id:'obra-1',obras:{name:'Depósito de prueba',encargado_name:'Responsable de prueba'},description:null,notes:null,qr_code:t.code}));
  const registry=[{id:'cat-14',name:'Escalera › 14 peldaños'}];
  let denyWrites=false;
  const writes=[];
  for (const viewport of [{width:1280,height:900},{width:390,height:844}]) {
    const page=await browser.newPage({viewport,serviceWorkers:'block'});
    page.setDefaultTimeout(15000);
    const openAdmin = async () => {
      const section = page.locator('details[data-catalog-admin]');
      if (await section.getAttribute('open') === null) await section.locator('summary').click();
    };
    const errors=[];
    let photos=0;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{
      const req=route.request();
      const url=new URL(req.url());
      if(url.origin===new URL(base).origin)return route.continue();
      if(!url.pathname.startsWith('/rest/v1/'))return route.abort();
      const table=url.pathname.split('/').pop();
      let data=[];
      if(table==='herramientas'){
        let rows=inventory.filter(t=>!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+t.id||url.searchParams.get('id')?.includes('('+t.id+')'));
        if(url.searchParams.get('id')?.startsWith('in.'))rows=inventory.filter(t=>url.searchParams.get('id').slice(4,-1).split(',').includes(t.id));
        if(req.method()==='PATCH'){
          writes.push(req.postDataJSON());
          if(denyWrites)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Edición denegada',code:'42501'})});
          if(url.searchParams.has('category'))rows=rows.filter(t=>url.searchParams.get('category')==='eq.'+t.category || (url.searchParams.get('category')==='is.null'&&t.category===null));
          rows.forEach(t=>Object.assign(t,req.postDataJSON()));
        }
        if(req.method()==='POST'){
          const payload=req.postDataJSON();
          const tool={...(Array.isArray(payload)?payload[0]:payload),id:'new-tool',obras:{name:'Depósito de prueba',encargado_name:null}};
          inventory.push(tool); rows=[tool]; writes.push(tool);
        }
        data=rows;
        if(url.searchParams.get('select')==='photo_url'){photos++;data={photo_url:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'};}
        else if(req.headers().accept?.includes('vnd.pgrst.object+json'))data=rows[0]||null;
      }
      if(table==='categorias_herramientas'){
        if(req.method()==='POST'){const row={...req.postDataJSON(),id:'registered-'+registry.length};registry.push(row);data=row;}
        else data=registry;
      }
      if(table==='obras')data=[{id:'obra-1',name:'Depósito de prueba',active:true,encargado_name:'Responsable de prueba'}];
      await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });

    await page.goto(base+'__tool-catalog');
    await page.getByText('Escalera',{exact:true}).waitFor();
    assert.equal(photos,0);
    await page.getByText('Escalera',{exact:true}).click();
    await page.getByRole('button',{name:/8 peldaños.*Ver herramientas/}).waitFor();
    assert.equal(photos,0,'Category and subcategory levels must not load photos');
    const labels=await page.locator('button').filter({hasText:'Ver herramientas'}).allTextContents();
    assert.ok(labels.findIndex(t=>t.includes('2 peldaños')&&!t.includes('12'))<labels.findIndex(t=>t.includes('8 peldaños')));
    await page.getByLabel('Estado',{exact:true}).selectOption('Disponible');
    const photoRequest=page.waitForRequest(req=>new URL(req.url()).searchParams.get('select')==='photo_url');
    await page.getByRole('button',{name:/8 peldaños.*Ver herramientas/}).click();
    await page.getByRole('heading',{name:'Escalera 8p',exact:true}).waitFor();
    await photoRequest;
    await page.getByRole('button',{name:'Ver ficha',exact:true}).click();
    await page.getByRole('button',{name:'Volver',exact:true}).click();
    await page.getByRole('heading',{name:'8 peldaños',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Estado',{exact:true}).inputValue(),'Disponible');
    await page.reload();
    await page.getByRole('heading',{name:'8 peldaños',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Estado',{exact:true}).inputValue(),'Disponible');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    await mkdir('scratch/catalog-qa',{recursive:true});
    await page.screenshot({path:'scratch/catalog-qa/tools-'+viewport.width+'.png',fullPage:true});
    await page.getByRole('navigation',{name:'Ruta de herramientas'}).getByRole('button',{name:'Herramientas',exact:true}).click();
    await page.getByLabel('Estado',{exact:true}).selectOption('');
    await page.getByLabel('Buscar herramientas').fill('Escalera 2 peldaños');
    await page.getByRole('heading',{name:'Escalera chica',exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Escalera 12 peldaños',exact:true}).count(),0);
    await page.getByLabel('Buscar herramientas').fill('Escalera 3');
    await page.getByText('Escalera › Peldaños por confirmar',{exact:true}).waitFor();

    if(viewport.width===1280){
      await page.getByLabel('Buscar herramientas').fill('ESC-08');
      await page.getByRole('button',{name:'Ver ficha',exact:true}).click();
      await page.getByRole('button',{name:'Editar',exact:true}).click();
      await page.getByLabel('Categoría principal *',{exact:true}).click();
      await page.getByRole('option',{name:'Amoladora',exact:true}).click();
      await page.getByLabel('Subcategoría *',{exact:true}).click();
      assert.equal(await page.getByRole('option',{name:'8 peldaños',exact:true}).count(),0,'Changing the parent must reset the variant');
      await page.getByRole('option',{name:'4 1/2 pulgadas',exact:true}).click();
      await page.getByRole('button',{name:'Cancelar',exact:true}).click();
      await page.getByRole('button',{name:'Editar',exact:true}).click();
      await page.getByLabel('Subcategoría *',{exact:true}).click();
      await page.getByRole('option',{name:'2 peldaños',exact:true}).click();
      await page.getByRole('button',{name:'Guardar',exact:true}).click();
      await page.getByRole('button',{name:'Editar',exact:true}).waitFor();
      assert.equal(inventory[0].category,'Escalera › 2 peldaños');
      await page.reload();
      await page.getByText('Escalera › 2 peldaños',{exact:true}).waitFor();
      // Restore this test record for the next viewport, then exercise Excel writes.
      inventory[0].category='Escalera 8p';
      await page.goto(base+'herramientas');
      await openAdmin();
      await page.getByRole('button',{name:'Importar categorías Excel',exact:true}).click();
      const workbook=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet([{'Código':'AM-750','Categoría principal':'Amoladora','Subcategoría':'7 pulgadas'}]),'Cambios');
      await page.getByLabel('Archivo de categorías').setInputFiles({name:'categorias.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(workbook,{type:'buffer',bookType:'xlsx'})});
      await page.getByRole('button',{name:'Aplicar 1 cambios',exact:true}).click();
      await page.getByText('Clasificación actualizada',{exact:true}).waitFor();
      assert.equal(inventory[4].category,'Amoladora › 7 pulgadas');
      inventory[4].category='Amoladora (4 1/2")';
      await page.goto(base+'herramientas');
      await openAdmin();
      await page.getByRole('button',{name:'Importar categorías Excel',exact:true}).click();
      await page.getByLabel('Archivo de categorías').setInputFiles({name:'categorias.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(workbook,{type:'buffer',bookType:'xlsx'})});
      denyWrites=true;
      await page.getByRole('button',{name:'Aplicar 1 cambios',exact:true}).click();
      await page.getByText('No se completó la importación',{exact:true}).waitFor();
      assert.equal(inventory[4].category,'Amoladora (4 1/2")');
      denyWrites=false;
      await page.getByRole('button',{name:'Cargar archivo',exact:true}).click({trial:true});
      await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});
      await page.getByRole('button',{name:'Gestionar categorías',exact:true}).click();
      await page.getByRole('button',{name:'Agregar',exact:true}).click();
      await page.getByLabel('Subcategoría',{exact:true}).fill('16 peldaños');
      await page.getByRole('button',{name:'Guardar',exact:true}).click();
      await page.getByText('Catálogo actualizado',{exact:true}).waitFor();
      assert.ok(registry.some(r=>r.name==='Escalera › 16 peldaños'));
      await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
      await page.goto(base+'herramientas/nueva');
      await page.getByLabel('Código Interno *',{exact:true}).fill('NEW-02');
      await page.getByLabel('Nombre de la Herramienta *',{exact:true}).fill('Escalera de prueba');
      await page.getByLabel('Subcategoría *',{exact:true}).click();
      await page.getByRole('option',{name:'2 peldaños',exact:true}).click();
      await page.getByLabel('Obra o Base Inicial *',{exact:true}).click();
      await page.getByRole('option',{name:'Depósito de prueba',exact:true}).click();
      await page.getByRole('button',{name:'Registrar Herramienta',exact:true}).click();
      await page.getByText('Escalera de prueba',{exact:true}).first().waitFor();
      assert.equal(inventory.find(t=>t.id==='new-tool').category,'Escalera › 2 peldaños');
      await page.goto(base+'solicitudes/nueva');
      await page.getByPlaceholder('Escribí para buscar herramienta...').fill('Escalera 2 peldaños');
      await page.getByRole('button').filter({hasText:'ESC-02'}).first().waitFor();
      assert.equal(await page.getByRole('button').filter({hasText:'ESC-12'}).count(),0);
      assert.equal(await page.getByRole('button').filter({hasText:'12 peldaños'}).count(),0);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: catalog '+viewport.width+'px, hierarchy, filters, reload, search, lazy photos'+(viewport.width===1280?', editing, Excel success/denial, registry, create tool, requests':''));
    await page.close();
  }
  assert.ok(writes.length>=3);
} finally { await browser?.close(); await server.close(); }
