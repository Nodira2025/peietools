
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function checkEmpleados() {
    const { data: empleados } = await supabase.from('empleados').select('full_name');
    console.log('Empleados:', JSON.stringify(empleados, null, 2));
}

checkEmpleados();
