import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Download } from 'lucide-react';

export default function Reports() {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOmzet, setTotalOmzet] = useState(0);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    // Fetch all sales items to calculate total omzet
    const { data } = await supabase.from('sales_order_items').select('qty, price, products(name), sales_orders(created_at, customers(name))');
    
    if (data) {
      setSalesData(data);
      setTotalOmzet(data.reduce((acc, row) => acc + (row.qty * row.price), 0));
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header className="flex-between" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Laporan & Analitik</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Lihat rekapitulasi penjualan dan performa bisnis.</p>
          </div>
          <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', gap: '0.5rem' }}>
            <Download size={18} /> Export / Print
          </button>
        </header>

        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', borderLeft: '4px solid var(--success)' }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600 }}>TOTAL OMZET (ALL TIME)</h3>
          <p style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--success)' }}>Rp {totalOmzet.toLocaleString('id-ID')}</p>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '1rem' }}>Rincian Penjualan</h2>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center' }}>Memuat data laporan...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Tanggal</th>
                  <th style={{ padding: '1rem' }}>Pelanggan</th>
                  <th style={{ padding: '1rem' }}>Produk</th>
                  <th style={{ padding: '1rem' }}>Jumlah</th>
                  <th style={{ padding: '1rem' }}>Harga Satuan</th>
                  <th style={{ padding: '1rem' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {salesData.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada data penjualan.</td></tr>
                ) : salesData.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{new Date(item.sales_orders?.created_at).toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{item.sales_orders?.customers?.name}</td>
                    <td style={{ padding: '1rem' }}>{item.products?.name}</td>
                    <td style={{ padding: '1rem' }}>{item.qty} Sak</td>
                    <td style={{ padding: '1rem' }}>Rp {item.price.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '1rem', fontWeight: 700 }}>Rp {(item.qty * item.price).toLocaleString('id-ID')}</td>
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
