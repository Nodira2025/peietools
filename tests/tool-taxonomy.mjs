import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ cacheDir: 'scratch/vite-taxonomy-test', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { classifyTool, matchesToolSearch, buildToolCatalog, compareSubcategories, serializeClassification } = await server.ssrLoadModule('/src/lib/toolTaxonomy.ts');
  const { planCategoryImport } = await server.ssrLoadModule('/src/lib/toolCategoryImport.ts');
  const ladder = { id:'one',code:'ESC-2',name:'Escalera 8p',category:'Escalera 8p',model:null };
  const cases = [
    [ladder, 'Escalera', '8 peldaños'],
    [{ name:'Escalera 3',category:'Escaleras',model:'Cant peldaños' },'Escalera','Peldaños por confirmar'],
    [{ name:'Escalera',category:'Escaleras',model:'Modelo 12' },'Escalera','Peldaños por confirmar'],
    [{ name:'Escalera 8 peldaños',category:'Escalera 10p' },'Escalera','Peldaños por confirmar'],
    [{ name:'Escalera 8 peldaños',category:'Equipos especiales › Alta tensión' },'Equipos especiales','Alta tensión'],
    [{ name:'Amoladora chica 750W',category:'Amoladora (4 1/2")' },'Amoladora','4 1/2 pulgadas'],
    [{ name:'Amoladora 750W modelo 900',category:'Amoladoras' },'Amoladora','Diámetro por confirmar'],
    [{ name:'Amoladora 230 mm',category:'Amoladoras' },'Amoladora','9 pulgadas'],
    [{ name:'Taladro',category:'Taladros' },'Taladro','Tipo por confirmar'],
    [{ name:'Retro Barovo',category:'Retro' },'Por clasificar','Retro · confirmar herramienta'],
    [{ name:'Retro Total SDS Plus',category:'Retro' },'Rotomartillo','SDS Plus'],
    [{ name:'Pinza de identar',category:'Otros',model:'16-120mm²' },'Pinza de indentar','16–120 mm²'],
    [{ name:'Cortacables / Pelacables a Criquet LCT',category:'Tijera cortacables' },'Cortacables','A criquet'],
    [{ name:'Escalera 8p',category:'Por clasificar › Tipo por confirmar' },'Por clasificar','Tipo por confirmar'],
  ];
  for (const [tool,category,subcategory] of cases) assert.deepEqual(classifyTool(tool),{category,subcategory});
  assert.equal(matchesToolSearch(ladder,'escaleras 8 peldaños'),true);
  assert.equal(matchesToolSearch(ladder,'Escalera › 8p'),true);
  assert.equal(matchesToolSearch(ladder,'Escalera 2 peldaños'),false,'A code containing 2 must not be mistaken for 2 steps');
  assert.equal(matchesToolSearch({name:'Escalera 12 peldaños'},'2 peldaños'),false);
  assert.equal(matchesToolSearch({name:'Amoladora 750W',category:'Amoladora (4 1/2")'},'Amoladora 7 pulgadas'),false);
  assert.equal(matchesToolSearch({name:'Amoladora 750W',category:'Amoladora (4 1/2")'},'Amoladora 7"'),false);
  assert.equal(matchesToolSearch({name:'Amoladora',category:'Amoladora (7")'},'7 pulgadas'),true);
  assert.equal(matchesToolSearch({name:'Pinza de indentar'},'pinza de identar'),true);
  assert.deepEqual(['10 peldaños','Por confirmar','2 peldaños','8 peldaños'].sort(compareSubcategories),['2 peldaños','8 peldaños','10 peldaños','Por confirmar']);
  const catalog = buildToolCatalog([ladder],['Escaleras','Escalera 8p','Escalera › 8 peldaños']);
  assert.equal(catalog.filter(c=>c.name==='Escalera').length,1);
  assert.equal(catalog.find(c=>c.name==='Escalera').subcategories.filter(s=>s==='8 peldaños').length,1);
  assert.equal(serializeClassification({category:'Escaleras',subcategory:'2p'}),'Escalera › 2 peldaños');

  const row = {'Código':'ESC-2','Categoría principal':'Escalera','Subcategoría':'2 peldaños'};
  const valid = planCategoryImport([row],[ladder],catalog);
  assert.deepEqual(valid.errors,[]);
  assert.equal(valid.rows[0].newCategory,'Escalera › 2 peldaños');
  assert.equal(valid.rows[0].changed,true);
  assert.ok(planCategoryImport([row,row],[ladder],catalog).errors.some(e=>e.includes('duplicado')));
  assert.ok(planCategoryImport([{...row,'Código':'DESCONOCIDO'}],[ladder],catalog).errors.length);
  assert.ok(planCategoryImport([{...row,'Subcategoría':'SDS Plus'}],[ladder],catalog).errors.length,'Subcategory must belong to its parent');
  assert.ok(planCategoryImport([{...row,'Subcategoría':''}],[ladder],catalog).errors.length);
  assert.equal(planCategoryImport([{'Código':'ESC-2','NUEVA CATEGORÍA':'Escalera 8p'}],[ladder],catalog).rows[0].changed,false,'Legacy templates remain readable');
  console.log('PASS: legacy classification, explicit overrides, conservative dimensions, search, ordering, Excel validation');
} finally { await server.close(); }
