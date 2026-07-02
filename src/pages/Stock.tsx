import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Minus, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Product { id: string; name: string; }
interface Warehouse { id: string; name: string; }
interface Movement {
  id: string; type: string; qty: number; created_at: string; ref_type: string;
  products: { name: string };
  warehouses: { name: string };
}

export default function Stock() {
  const { profile } = useAuth();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'in' | 'out'>('in');
  const [formData, setFormData] = useState({ product_id: '', warehouse_id: '', qty: 0, ref_type: 'manual' });
  const [opnames, setOpnames] = useState<any[]>([]);
  const [currentStock, setCurrentStock] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'saat_ini' | 'riwayat' | 'opname'>('saat_ini');
  const [formDataOpname, setFormDataOpname] = useState({ product_id: '', warehouse_id: '', system_qty: 0, physical_qty: 0, note: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [movRes, prodRes, whRes, opRes, currRes] = await Promise.all([
      supabase.from('stock_movements').select('*, products(name), warehouses(name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('products').select('id, name'),
      supabase.from('warehouses').select('id, name'),
      supabase.from('stock_opname').select('*, products(name), warehouses(name)').order('date', { ascending: false }),
      supabase.from('stock_summary').select('*, products(name), warehouses(name)')
    ]);
    
    if (movRes.data) setMovements(movRes.data as any);
    if (prodRes.data) setProducts(prodRes.data);
    if (whRes.data) {
      setWarehouses(whRes.data);
      if (whRes.data.length > 0) {
        setFormData(f => ({ ...f, warehouse_id: whRes.data[0].id }));
        setFormDataOpname(f => ({ ...f, warehouse_id: whRes.data[0].id }));
      }
    }
    if (opRes.data) setOpnames(opRes.data);
    if (currRes.data) setCurrentStock(currRes.data);
    
    if (prodRes.data && prodRes.data.length > 0) {
      setFormData(f => ({ ...f, product_id: prodRes.data[0].id }));
      setFormDataOpname(f => ({ ...f, product_id: prodRes.data[0].id }));
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id || !formData.warehouse_id || formData.qty <= 0) return alert('Data tidak valid');
    
    const { error } = await supabase.from('stock_movements').insert([{
      ...formData,
      type: modalType,
      created_by: profile?.id
    }]);

    if (error) {
      alert('Gagal menyimpan stok: ' + error.message);
    } else {
      setIsModalOpen(false);
      fetchData();
    }
  };

  const handleSaveOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('stock_opname').insert([{
      ...formDataOpname,
      created_by: profile?.id
    }]);

    if (!error) {
      // Create adjustment in stock_movements
      const diff = formDataOpname.physical_qty - formDataOpname.system_qty;
      if (diff !== 0) {
        await supabase.from('stock_movements').insert([{
          product_id: formDataOpname.product_id,
          warehouse_id: formDataOpname.warehouse_id,
          type: diff > 0 ? 'in' : 'out',
          qty: Math.abs(diff),
          ref_type: 'opname',
          created_by: profile?.id
        }]);
      }
      setIsModalOpen(false);
      fetchData();
    }
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Manajemen Stok</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Catat barang masuk, barang keluar, dan lihat riwayat (Kartu Stok).</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={() => { setModalType('in'); setIsModalOpen(true); }} style={{ display: 'flex', gap: '0.5rem' }}>
                <Plus size={18} /> Terima dari PT Ris Investindo
              </button>
              <button className="btn" onClick={() => { setModalType('out'); setIsModalOpen(true); }} style={{ backgroundColor: 'var(--warning)', color: 'white', display: 'flex', gap: '0.5rem' }}>
                <Minus size={18} /> Stok Keluar
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className={`btn ${activeTab === 'saat_ini' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('saat_ini')} style={{ backgroundColor: activeTab !== 'saat_ini' ? 'var(--bg-secondary)' : undefined, color: activeTab !== 'saat_ini' ? 'var(--text-primary)' : undefined }}>Stok Saat Ini</button>
            <button className={`btn ${activeTab === 'riwayat' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('riwayat')} style={{ backgroundColor: activeTab !== 'riwayat' ? 'var(--bg-secondary)' : undefined, color: activeTab !== 'riwayat' ? 'var(--text-primary)' : undefined }}>Riwayat (Kartu Stok)</button>
            <button className={`btn ${activeTab === 'opname' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('opname')} style={{ backgroundColor: activeTab !== 'opname' ? 'var(--bg-secondary)' : undefined, color: activeTab !== 'opname' ? 'var(--text-primary)' : undefined }}>Stok Opname</button>
          </div>
        </header>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center' }}>Memuat data...</p>
          ) : activeTab === 'saat_ini' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Produk</th>
                  <th style={{ padding: '1rem' }}>Gudang Lokasi</th>
                  <th style={{ padding: '1rem' }}>Total Sisa Stok</th>
                </tr>
              </thead>
              <tbody>
                {currentStock.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada data stok barang.</td></tr>
                ) : currentStock.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{row.products?.name}</td>
                    <td style={{ padding: '1rem' }}>{row.warehouses?.name}</td>
                    <td style={{ padding: '1rem', fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary-color)' }}>{row.current_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'riwayat' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Waktu</th>
                  <th style={{ padding: '1rem' }}>Produk</th>
                  <th style={{ padding: '1rem' }}>Gudang</th>
                  <th style={{ padding: '1rem' }}>Jenis</th>
                  <th style={{ padding: '1rem' }}>Jumlah</th>
                  <th style={{ padding: '1rem' }}>Referensi</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{new Date(m.created_at).toLocaleString('id-ID')}</td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{m.products?.name}</td>
                    <td style={{ padding: '1rem' }}>{m.warehouses?.name}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: m.type === 'in' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: m.type === 'in' ? 'var(--success)' : 'var(--danger)' }}>
                        {m.type === 'in' ? 'MASUK' : 'KELUAR'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 700 }}>{m.qty}</td>
                    <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{m.ref_type?.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Riwayat Stok Opname</h2>
                <button className="btn btn-primary" onClick={() => { setIsModalOpen(true); }} style={{ fontSize: '0.875rem' }}>+ Buat Opname</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '1rem' }}>Tanggal</th>
                    <th style={{ padding: '1rem' }}>Produk</th>
                    <th style={{ padding: '1rem' }}>Sistem</th>
                    <th style={{ padding: '1rem' }}>Fisik</th>
                    <th style={{ padding: '1rem' }}>Selisih</th>
                    <th style={{ padding: '1rem' }}>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {opnames.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada data opname.</td></tr>
                  ) : opnames.map((op) => (
                    <tr key={op.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem' }}>{new Date(op.date).toLocaleDateString('id-ID')}</td>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{op.products?.name}</td>
                      <td style={{ padding: '1rem' }}>{op.system_qty}</td>
                      <td style={{ padding: '1rem', fontWeight: 700 }}>{op.physical_qty}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ color: op.physical_qty - op.system_qty < 0 ? 'var(--danger)' : op.physical_qty - op.system_qty > 0 ? 'var(--success)' : 'inherit' }}>
                          {op.physical_qty - op.system_qty > 0 ? '+' : ''}{op.physical_qty - op.system_qty}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>{op.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{activeTab === 'opname' ? 'Input Stok Opname' : modalType === 'in' ? 'Penerimaan dari PT Ris Investindo' : 'Input Stok Keluar'}</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)} style={{ padding: '0.25rem' }}>Tutup</button>
            </div>
            {activeTab !== 'opname' ? (
              <form onSubmit={handleSave}>
                <div className="input-group">
                  <label className="input-label">Pilih Produk</label>
                  <select className="input-field" value={formData.product_id} onChange={e => setFormData({...formData, product_id: e.target.value})}>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Pilih Gudang</label>
                  <select className="input-field" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                <label className="input-label">Total Semen Masuk (Jumlah Sak)</label>
                <input required type="text" className="input-field" value={formData.qty} onChange={e => setFormData({...formData, qty: parseInt(e.target.value) || 0})} placeholder="Misal: 160" />
              </div>
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan Stok</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveOpname}>
                <div className="input-group">
                  <label className="input-label">Produk</label>
                  <select className="input-field" value={formDataOpname.product_id} onChange={e => setFormDataOpname({...formDataOpname, product_id: e.target.value})}>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Gudang</label>
                  <select className="input-field" value={formDataOpname.warehouse_id} onChange={e => setFormDataOpname({...formDataOpname, warehouse_id: e.target.value})}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Stok Sistem Saat Ini</label>
                    <input required type="text" className="input-field" value={formDataOpname.system_qty} onChange={e => setFormDataOpname({...formDataOpname, system_qty: Number(e.target.value) || 0})} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Stok Fisik (Aktual)</label>
                    <input required type="text" className="input-field" value={formDataOpname.physical_qty} onChange={e => setFormDataOpname({...formDataOpname, physical_qty: Number(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Keterangan / Alasan Selisih</label>
                  <input type="text" className="input-field" value={formDataOpname.note} onChange={e => setFormDataOpname({...formDataOpname, note: e.target.value})} placeholder="Misal: 2 sak rusak" />
                </div>
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan Opname & Sesuaikan Stok</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
