import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';

export default function Finance() {
  const [receivables, setReceivables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('receivables').select('*, customers(name), sales_orders(created_at)').order('created_at', { ascending: false });
    if (data) setReceivables(data);
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    await supabase.from('receivables').update({ status: newStatus }).eq('id', id);
    fetchData();
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Keuangan (Piutang)</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Pantau tagihan pelanggan yang belum dibayar lunas.</p>
        </header>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center' }}>Memuat data...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Tgl Tagihan</th>
                  <th style={{ padding: '1rem' }}>Pelanggan</th>
                  <th style={{ padding: '1rem' }}>Jumlah Piutang</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {receivables.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>Tidak ada data piutang.</td></tr>
                ) : receivables.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{new Date(r.sales_orders?.created_at).toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{r.customers?.name}</td>
                    <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--danger)' }}>Rp {r.amount.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                        backgroundColor: r.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: r.status === 'paid' ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {r.status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {r.status !== 'paid' && (
                        <button className="btn btn-primary" onClick={() => handleUpdateStatus(r.id, 'paid')} style={{ fontSize: '0.75rem', padding: '0.5rem' }}>
                          Tandai Lunas
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
