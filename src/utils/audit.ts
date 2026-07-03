import { supabase } from '../services/supabaseClient';

export async function logActivity(
  userId: string | undefined,
  userName: string | undefined,
  action: string,
  details: string
) {
  try {
    await supabase.from('audit_logs').insert([{
      user_id: userId || null,
      user_name: userName || 'Sistem',
      action,
      details
    }]);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
