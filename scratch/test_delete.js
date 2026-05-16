
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function testDelete() {
    // Buscar una orden de prueba
    const { data: ordenes } = await supabase.from('ordenes_trabajo').select('id').limit(1);
    if (!ordenes || ordenes.length === 0) {
        console.log('No hay ordenes para borrar');
        return;
    }
    
    const id = ordenes[0].id;
    console.log('Intentando borrar orden:', id);
    
    const { error, count } = await supabase
        .from('ordenes_trabajo')
        .delete()
        .eq('id', id);
        
    console.log('Error:', error);
    console.log('Count:', count);
}

testDelete();
