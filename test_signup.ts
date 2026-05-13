import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function testSignUp() {
  console.log('Intentando registrar test@peie.com...');
  const { data, error } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@peie.com',
    password: 'password123',
    options: {
      data: {
        full_name: 'Test User',
        role: 'encargado',
        whatsapp: '123456789'
      }
    }
  });

  if (error) {
    console.error('ERROR AL REGISTRAR:', error.message);
  } else {
    console.log('REGISTRO EXITOSO:', data.user?.email);
    
    console.log('Intentando hacer login inmediatamente...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: data.user?.email || '',
      password: 'password123'
    });

    if (loginError) {
      console.error('ERROR AL LOGUEAR:', loginError.message);
    } else {
      console.log('LOGIN EXITOSO:', loginData.user?.email);
    }
  }
}

testSignUp();
