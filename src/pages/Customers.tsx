import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, X } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  type: string;
  contact: string;
  address: string;
}

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({ name: '', type: 'toko', contact: '', address: '' });

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus pelanggan ini?')) return;
    await supabase.from('customers').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await supabase.from('customers').insert([formData]).select();
    if (data) {
      setItems([data[0], ...items]);
      setIsModalOpen(false);
      setFormData({ name: '', type: 'toko', contact: '', address: '' });
    }
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header className="flex-between" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Data Pelanggan</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Kelola data distributor dan toko langganan.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', gap: '0.5rem' }}>
            <Plus size={18} /> Tambah Pelanggan
          </button>
        </header>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center' }}>Memuat data...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Nama Pelanggan</th>
                  <th style={{ padding: '1rem' }}>Tipe</th>
                  <th style={{ padding: '1rem' }}>Kontak</th>
                  <th style={{ padding: '1rem' }}>Alamat</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada data.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{item.type}</td>
                    <td style={{ padding: '1rem' }}>{item.contact}</td>
                    <td style={{ padding: '1rem' }}>{item.address}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button onClick={() => handleDelete(item.id)} className="btn" style={{ padding: '0.25rem 0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Tambah Pelanggan</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="input-group">
                <label className="input-label">Nama Toko / Pelanggan</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Tipe Pelanggan</label>
                <select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="toko">Toko</option>
                  <option value="distributor">Distributor</option>
                  <option value="individu">Individu</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">No. Telepon / WA (Harus 13 Angka)</label>
                <input required type="text" className="input-field" pattern="[0-9]{13}" minLength={13} maxLength={13} title="Harus tepat 13 angka" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value.replace(/\D/g, '')})} placeholder="Contoh: 0812345678901" />
              </div>
              <div className="input-group">
                <label className="input-label">Alamat Lengkap</label>
                <textarea required className="input-field" rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
