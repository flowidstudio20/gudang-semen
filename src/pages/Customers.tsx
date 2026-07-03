import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, X, Edit, Eye } from 'lucide-react';

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
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({ id: '', name: '', type: 'toko', contact: '', address: '' });
  const [searchQuery, setSearchQuery] = useState('');

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
    if (formData.id) {
      const { error } = await supabase.from('customers').update({
        name: formData.name,
        type: formData.type,
        contact: formData.contact,
        address: formData.address
      }).eq('id', formData.id);
      
      if (!error) {
        setItems(items.map(i => i.id === formData.id ? { ...i, ...formData } as Customer : i));
        setIsModalOpen(false);
        setFormData({ id: '', name: '', type: 'toko', contact: '', address: '' });
      } else {
        alert('Gagal mengupdate pelanggan: ' + error.message);
      }
    } else {
      const { data, error } = await supabase.from('customers').insert([{ 
        name: formData.name, 
        type: formData.type, 
        contact: formData.contact, 
        address: formData.address 
      }]).select();
      
      if (data) {
        setItems([data[0], ...items]);
        setIsModalOpen(false);
        setFormData({ id: '', name: '', type: 'toko', contact: '', address: '' });
      } else if (error) {
        alert('Gagal menambah pelanggan: ' + error.message);
      }
    }
  };

  const handleEdit = (item: Customer) => {
    setFormData(item);
    setIsModalOpen(true);
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header className="flex-between" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Data Pelanggan</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Kelola data distributor dan toko langganan.</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setFormData({ id: '', name: '', type: 'toko', contact: '', address: '' }); setIsModalOpen(true); }} style={{ display: 'flex', gap: '0.5rem' }}>
            <Plus size={18} /> Tambah Pelanggan
          </button>
        </header>

        <div style={{ marginBottom: '1rem' }}>
          <input type="text" className="input-field" placeholder="🔍 Cari pelanggan berdasarkan nama, tipe, atau kontak..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ maxWidth: '400px' }} />
        </div>

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
                ) : items.filter(item =>
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.contact.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{item.type}</td>
                    <td style={{ padding: '1rem' }}>{item.contact}</td>
                    <td style={{ padding: '1rem' }}>{item.address}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setSelectedItem(item); setIsDetailOpen(true); }} className="btn" style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} title="Detail">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleEdit(item)} className="btn" style={{ padding: '0.25rem 0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="btn" style={{ padding: '0.25rem 0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }} title="Hapus">
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formData.id ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h2>
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
                <label className="input-label">No. Telepon / WA (Maks 13 Angka)</label>
                <input required type="text" className="input-field" maxLength={13} value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value.replace(/\D/g, '')})} placeholder="Contoh: 081234567890" />
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

      {isDetailOpen && selectedItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Detail Pelanggan</h2>
              <button className="btn" onClick={() => setIsDetailOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Nama Pelanggan</span>
                <span style={{ fontWeight: 600 }}>{selectedItem.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tipe Pelanggan</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{selectedItem.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Kontak / Telepon</span>
                <span style={{ fontWeight: 600 }}>{selectedItem.contact}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Alamat Lengkap</span>
                <span style={{ fontWeight: 500, lineHeight: 1.5 }}>{selectedItem.address}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsDetailOpen(false)}>Tutup Detail</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
