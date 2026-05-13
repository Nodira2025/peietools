import { createClient } from '@supabase/supabase-js';


const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function test() {
  console.log('Intentando login con encargado@peie.local...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'encargado@peie.local',
    password: '12345678'
  });

  if (error) {
    console.error('ERROR AL LOGUEAR:', error.message);
  } else {
    console.log('LOGIN EXITOSO:', data.user?.email);
  }
}

test();
