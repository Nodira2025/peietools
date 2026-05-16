
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function testQuery() {
    const encargado_name = "Franco";
    const { data, error } = await supabase
        .from('profiles')
        .select('full_name, whatsapp')
        .ilike('full_name', `%${encargado_name}%`)
        .not('whatsapp', 'is', null)
        .limit(1)
        .maybeSingle();
        
    console.log('Result:', data);
    if (error) console.error('Error:', error);
}

testQuery();
