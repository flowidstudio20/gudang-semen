import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are missing. Please add them to your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true, // Menyimpan sesi login di localStorage (tidak keluar saat refresh/tutup tab)
    autoRefreshToken: true, // Otomatis memperbarui token login di background
    detectSessionInUrl: true, // Mendeteksi sesi dari URL (berguna untuk OAuth/Magic Link)
  }
});
