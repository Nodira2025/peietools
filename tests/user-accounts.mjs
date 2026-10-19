import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
const realRequire = createRequire(import.meta.url);
async function load(path, overrides = {}) {
  const source = await readFile(path,'utf8');
  const code = ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports:{} };
  new Function('require','module','exports',code)(id => overrides[id] || realRequire(id),module,module.exports);
  return module.exports;
}
const { normalizeUsername, loginEmail, validateUserAccount, accountErrorMessage } = await load('src/lib/userAccounts.ts');
assert.equal(normalizeUsername(' Patricio@PEIE.com '),'patricio');
assert.equal(loginEmail(' Patricio '),'patricio@peie.com');
assert.equal(loginEmail(' Persona@ejemplo.com '),'persona@ejemplo.com');
const valid = { username:' Coordinador ', fullName:'Persona',role:'solicitante',password:'fixture-password',creating:true };
assert.equal(validateUserAccount(valid),null);
for (const patch of [{username:'  '},{username:'dos palabras'},{username:'a@peie.com@peie.com'},{role:''},{fullName:' '},{password:'123'},{password:'😀😀😀'},{password:'      '},{password:'á'.repeat(37)}]) assert.ok(validateUserAccount({...valid,...patch}));
assert.equal(validateUserAccount({...valid,creating:false,password:''}),null);
assert.match(accountErrorMessage({message:'Database error querying schema'},''),/no hace falta crear otro usuario/);
assert.match(accountErrorMessage({message:'duplicate',code:'23505'},''),/ya existe/);

let profile = { id:'fixture',role:'solicitante',active:true };
let profileError = null;
let session = {user:{id:'fixture'}};
const signouts = [];
const client = {
  auth:{ getSession:async()=>({data:{session},error:null}),signOut:async opts=>{signouts.push(opts);return {error:null};} },
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:profile,error:profileError})})})}),
};
const { useAuthStore } = await load('src/store/auth.ts',{'../lib/supabase':{supabase:client}});
await useAuthStore.getState().checkUser();
assert.equal(useAuthStore.getState().user.id,'fixture');
profile = null;
await useAuthStore.getState().checkUser();
assert.match(useAuthStore.getState().error,/perfil completo/);
assert.equal(useAuthStore.getState().user,null);
profileError = {message:'network'};
await useAuthStore.getState().checkUser();
assert.match(useAuthStore.getState().error,/conexión/);
profileError = null;profile = {id:'fixture',role:'solicitante',active:false};
await useAuthStore.getState().checkUser();
assert.match(useAuthStore.getState().error,/inactivo/);
assert.deepEqual(signouts,[{scope:'local'}]);
session = null;
await useAuthStore.getState().checkUser();
assert.equal(useAuthStore.getState().error,null);
assert.equal(useAuthStore.getState().loading,false);
console.log('PASS: validacion del formulario, email consistente, errores explicados y rechazo de perfiles ausentes/inactivos.');
