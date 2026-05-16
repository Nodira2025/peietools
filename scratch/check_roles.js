
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function checkRoles() {
    const { data: profiles } = await supabase.from('profiles').select('full_name, role');
    console.log('Profiles with Roles:', JSON.stringify(profiles, null, 2));
}

checkRoles();
