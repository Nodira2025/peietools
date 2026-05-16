
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, key);

async function introspect() {
    const { data, error } = await supabase
        .from('traslados_personal')
        .select(`
            id,
            source_obra_id,
            target_obra_id,
            requester_id
        `)
        .limit(1);
    
    if (error) {
        console.error('Error fetching data:', error);
        return;
    }
    console.log('Sample Data:', data);
    
    // Intentar un join simple con uno solo
    const { error: joinError } = await supabase
        .from('traslados_personal')
        .select(`
            id,
            source_obra:obras!source_obra_id(name)
        `)
        .limit(1);
    
    if (joinError) {
        console.error('Join Error (source_obra):', joinError);
    } else {
        console.log('Join success (source_obra)');
    }

    const { error: joinError2 } = await supabase
        .from('traslados_personal')
        .select(`
            id,
            requester:profiles!requester_id(full_name)
        `)
        .limit(1);
    
    if (joinError2) {
        console.error('Join Error (requester):', joinError2);
    } else {
        console.log('Join success (requester)');
    }
}

introspect();
