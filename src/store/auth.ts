import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  role: string;
  whatsapp: string | null;
  obra_id: string | null;
  active: boolean;
  photo_url?: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  checkUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,
  checkUser: async () => {
    set({ error: null });
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error('No se pudo verificar la sesión. Volvé a ingresar.');
      if (session?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) throw new Error('No se pudo cargar tu perfil. Revisá la conexión y volvé a intentar.');
        if (!profile) throw new Error('Tu cuenta no tiene un perfil completo. Comunicate con Administración.');
        if (!profile.active) {
          await supabase.auth.signOut({ scope: 'local' });
          throw new Error('Tu usuario está inactivo. Comunicate con Administración.');
        }
        
        set({ user: session.user, profile, loading: false });
      } else {
        set({ user: null, profile: null, loading: false });
      }
    } catch (error) {
      set({ user: null, profile: null, loading: false, error: error instanceof Error ? error.message : 'No se pudo verificar tu acceso.' });
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, error: null });
  },
}));
