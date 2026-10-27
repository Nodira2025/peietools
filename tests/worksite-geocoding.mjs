import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
let source=await readFile('src/lib/worksiteGeocoding.ts','utf8');
source=source.replace('import.meta.env.VITE_GEOCODING_URL','undefined');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseAddressMatches,findWorksiteAddress}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const feature={geometry:{coordinates:[-65.2045,-26.83113]},properties:{name:'Plaza Independencia',city:'San Miguel de Tucumán',countrycode:'AR'}};
assert.equal(parseAddressMatches({features:[feature]})[0].latitude,-26.83113);
for(const bad of [null,{}, {features:[null]}, {features:[{...feature,geometry:{coordinates:[999,0]}}]}, {features:[{...feature,geometry:{coordinates:['-65','-26']}}]}, {features:[{...feature,properties:{...feature.properties,countrycode:'FR'}}]}]) assert.deepEqual(parseAddressMatches(bad),[]);
let calls=0;
const realFetch=globalThis.fetch;
try {
 globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({features:[feature]})};};
 const a=await findWorksiteAddress('Plaza Independencia, Tucuman',new AbortController().signal);
 const b=await findWorksiteAddress('Plaza Independencia, Tucuman',new AbortController().signal);
 assert.deepEqual(a,b);assert.equal(calls,1,'Reutiliza la consulta sin enviar otra solicitud');
 await assert.rejects(()=>findWorksiteAddress('Otro domicilio',new AbortController().signal),/Esperá/);
 await assert.rejects(()=>findWorksiteAddress('a',new AbortController().signal),/calle/);
} finally {globalThis.fetch=realFetch;}
console.log('PASS: coordenadas, pais, respuesta invalida, cache y limite de consultas.');
