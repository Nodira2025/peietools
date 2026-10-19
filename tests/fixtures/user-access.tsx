import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Usuarios from '../../src/pages/Usuarios';
import Login from '../../src/pages/Login';
import { useAuthStore } from '../../src/store/auth';
import { supabase } from '../../src/lib/supabase';
import { Toaster } from '../../src/components/ui/toaster';
import { normalizeUsername } from '../../src/lib/userAccounts';
import '../../src/index.css';

const scenario = new URL(location.href).searchParams.get('scenario') || 'admin';
const admin = {id:'qa-admin',full_name:'Administración de prueba',username:'admin.qa',role:'admin',active:true,whatsapp:null,obra_id:null};
const coordinator = {id:'qa-coordinator',full_name:'Coordinador de prueba',username:'coordinador.qa',role:'solicitante',active:true,whatsapp:null,obra_id:null};
const users = [admin,coordinator];
let requestSummary = 'Sin operaciones';
const renderSummary = () => { const el=document.getElementById('qa-result'); if(el)el.textContent=requestSummary; };
const fakeAuth = {
  signInWithPassword:async()=>({data:{user:{id:coordinator.id}},error:null}),
  getSession:async()=>({data:{session:{user:{id:coordinator.id}}},error:null}),
  signOut:async()=>({error:null}),
};
Object.assign(supabase.auth,fakeAuth);
Object.assign(supabase,{
  from:()=>{
    const query={
      select:()=>query,eq:()=>query,
      order:async()=>({data:[...users],error:null}),
      maybeSingle:async()=>({data:scenario==='missing'?null:{...coordinator,active:scenario!=='inactive'},error:scenario==='network'?{message:'Fixture network failure'}:null}),
    };return query;
  },
  rpc:async(name:string,args:Record<string,string|boolean|null>)=>{
    await new Promise(resolve=>setTimeout(resolve,350));
    if(name==='admin_create_user'){
      const username=normalizeUsername(String(args.p_username));
      if(users.some(u=>u.username===username))return {data:null,error:{code:'23505',message:'Ese usuario ya existe'}};
      const id=`qa-${users.length}`;
      users.push({...coordinator,id,username,full_name:String(args.p_full_name),role:String(args.p_role)});
      requestSummary=`Alta guardada: ${username}; rol: ${args.p_role}`;renderSummary();
      return {data:id,error:null};
    }
    if(name==='admin_update_user_v2'){
      const found=users.find(u=>u.id===args.p_user_id);
      if(found)Object.assign(found,{username:args.p_new_username,full_name:args.p_new_full_name,role:args.p_new_role,active:args.p_new_active});
      requestSummary=`Estado guardado: activo=${args.p_new_active}; contraseña ${args.p_new_password===null?'conservada':'reemplazada'}`;renderSummary();
      return {data:null,error:null};
    }
    return {data:null,error:{message:'RPC inesperada'}};
  },
});
useAuthStore.setState({loading:false,error:null,user:location.pathname.endsWith('/usuarios')?{id:admin.id} as never:null,
  profile:location.pathname.endsWith('/usuarios')?(scenario==='coordinator'?coordinator:admin):null});
createRoot(document.getElementById('root')!).render(<BrowserRouter>
  <div className="bg-amber-100 p-3 text-sm">Prueba local con datos ficticios. <span id="qa-result">{requestSummary}</span></div>
  <Routes><Route path="/qa/usuarios" element={<div className="p-6"><Usuarios/></div>}/><Route path="/qa/login" element={<Login/>}/>
    <Route path="/bienvenida" element={<h1>Ingreso completado en prueba local</h1>}/></Routes><Toaster/>
</BrowserRouter>);
