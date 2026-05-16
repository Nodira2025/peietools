
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function verifyDelete() {
    const id = '37c10194-375e-4178-b933-33a3db1034cd';
    const { data } = await supabase.from('ordenes_trabajo').select('id').eq('id', id).maybeSingle();
    if (data) {
        console.log('LA ORDEN SIGUE AHI. El borrado fallo silenciosamente (RLS).');
    } else {
        console.log('La orden fue borrada correctamente.');
    }
}

verifyDelete();
