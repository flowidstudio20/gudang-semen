import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Shield, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuditLog {
  id: string;
  user_name: string;
  action: string;
  details: string;
  created_at: string;
}

export default function AuditLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setLogs(data as AuditLog[]);
    setLoading(false);
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('DELETE')) return { bg: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' };
    if (action.includes('APPROVE') || action.includes('SAVE') || action.includes('CONFIRM')) return { bg: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' };
    if (action.includes('REJECT') || action.includes('CANCEL')) return { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' };
    return { bg: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)' };
  };

  if (profile?.role !== 'admin') {
    return (
      <Layout>
        <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <Shield size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Akses Ditolak</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Hanya Admin yang dapat melihat log audit sistem.</p>
        </div>
      </Layout>
    );
  }

  const filteredLogs = logs.filter(log => 
    (log.user_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.action || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (log.details || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={26} color="var(--primary-color)" /> Log Aktivitas Sistem (Audit Log)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Pantau seluruh riwayat tindakan, perubahan stok, dan transaksi keuangan oleh seluruh staf secara real-time.
          </p>
        </header>

        {/* Search */}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="🔍 Cari berdasarkan nama, tindakan, keterangan..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              style={{ width: '100%' }}
            />
          </div>
          <button className="btn" onClick={fetchLogs} style={{ height: '40px', backgroundColor: 'var(--bg-secondary)' }}>
            Refresh
          </button>
        </div>

        {/* Logs List */}
        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem', width: '180px' }}>Waktu Kejadian</th>
                  <th style={{ padding: '1rem', width: '150px' }}>Pengguna</th>
                  <th style={{ padding: '1rem', width: '200px' }}>Tindakan</th>
                  <th style={{ padding: '1rem' }}>Rincian Detail</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada catatan aktivitas.</td></tr>
                ) : filteredLogs.map((log) => {
                  const badge = getActionBadgeColor(log.action);
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(log.created_at).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{log.user_name}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                          backgroundColor: badge.bg, color: badge.color
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', lineHeight: 1.4 }}>{log.details}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
