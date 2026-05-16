
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function checkFKs() {
    const { data, error } = await supabase.rpc('get_table_info', { table_name: 'traslados_personal' });
    // Si no tenemos la RPC, usamos una query a information_schema
    // Pero como no podemos hacer query directa a information_schema via API anon,
    // intentaremos deducirlo provocando errores o usando la introspection anterior.
    console.log('Este script requiere una funcion RPC para ver el schema real.');
}

// Intentar ver si las columnas existen al menos
async function checkColumns() {
    const { data, error } = await supabase.from('traslados_personal').select('*').limit(1);
    if (error) console.error(error);
    else console.log('Columns exist:', Object.keys(data[0] || {}));
}

checkColumns();
