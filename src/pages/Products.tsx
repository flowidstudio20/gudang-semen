import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Edit2, Trash2, X, Eye } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  brand: string;
  unit: string;
  buy_price: number;
  sell_price: number;
  min_stock: number;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', brand: '', unit: 'Sak', buy_price: 0, sell_price: 0, min_stock: 0
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Gagal memuat data produk.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus produk ini?')) return;
    
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Gagal menghapus produk.');
    }
  };

  const handleEdit = (product: Product) => {
    setFormData(product);
    setEditingId(product.id);
    setIsModalOpen(true);
  };

  const handleOpenDetail = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { data, error } = await supabase
          .from('products')
          .update(formData)
          .eq('id', editingId)
          .select();
        if (error) throw error;
        if (data) {
          setProducts(products.map(p => p.id === editingId ? data[0] : p));
          setIsModalOpen(false);
          setEditingId(null);
          setFormData({ name: '', brand: '', unit: 'Sak', buy_price: 0, sell_price: 0, min_stock: 0 });
        }
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([formData])
          .select();
          
        if (error) throw error;
        
        if (data) {
          setProducts([data[0], ...products]);
          setIsModalOpen(false);
          setFormData({ name: '', brand: '', unit: 'Sak', buy_price: 0, sell_price: 0, min_stock: 0 });
        }
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Gagal menyimpan produk.');
    }
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header className="flex-between" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Data Produk</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Kelola jenis semen dan harganya.</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditingId(null); setFormData({ name: '', brand: '', unit: 'Sak', buy_price: 0, sell_price: 0, min_stock: 0 }); setIsModalOpen(true); }} style={{ display: 'flex', gap: '0.5rem' }}>
            <Plus size={18} /> Tambah Produk
          </button>
        </header>

        <div style={{ marginBottom: '1rem' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="🔍 Cari produk berdasarkan nama atau merk..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            style={{ maxWidth: '400px' }}
          />
        </div>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Memuat data...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Nama Produk</th>
                  <th style={{ padding: '1rem' }}>Merk</th>
                  <th style={{ padding: '1rem' }}>Satuan</th>
                  <th style={{ padding: '1rem' }}>Harga Beli</th>
                  <th style={{ padding: '1rem' }}>Harga Jual</th>
                  <th style={{ padding: '1rem' }}>Stok Min.</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Belum ada data produk.
                    </td>
                  </tr>
                ) : (
                  products.filter(p => 
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (p.brand || '').toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((product) => (
                    <tr key={product.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{product.name}</td>
                      <td style={{ padding: '1rem' }}>{product.brand || '-'}</td>
                      <td style={{ padding: '1rem' }}>{product.unit}</td>
                      <td style={{ padding: '1rem' }}>Rp {product.buy_price.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '1rem' }}>Rp {product.sell_price.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '1rem' }}>{product.min_stock}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <button className="btn" onClick={() => handleOpenDetail(product)} style={{ padding: '0.25rem 0.5rem', marginRight: '0.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                          <Eye size={16} />
                        </button>
                        <button className="btn" onClick={() => handleEdit(product)} style={{ padding: '0.25rem 0.5rem', marginRight: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)' }}>
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn" 
                          onClick={() => handleDelete(product.id)}
                          style={{ padding: '0.25rem 0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Add Product */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{editingId ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
              <button className="btn" onClick={() => { setIsModalOpen(false); setEditingId(null); }} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="input-group">
                <label className="input-label">Nama Produk</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Semen Tiga Roda 50kg" />
              </div>
              <div className="input-group">
                <label className="input-label">Merk</label>
                <input type="text" className="input-field" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="Tiga Roda" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Harga Beli</label>
                  <input required type="number" className="input-field" value={formData.buy_price} onChange={e => setFormData({...formData, buy_price: Number(e.target.value)})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Harga Jual</label>
                  <input required type="number" className="input-field" value={formData.sell_price} onChange={e => setFormData({...formData, sell_price: Number(e.target.value)})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Satuan</label>
                  <input required type="text" className="input-field" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Stok Minimum</label>
                  <input required type="number" className="input-field" value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: Number(e.target.value)})} />
                </div>
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan Produk</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Product */}
      {isDetailOpen && selectedProduct && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Detail Produk</h2>
              <button className="btn" onClick={() => setIsDetailOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>ID Produk</span>
                <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.875rem' }}>{selectedProduct.id.substring(0, 8)}...</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Nama Produk</span>
                <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>{selectedProduct.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Merk & Satuan</span>
                <span style={{ fontWeight: 500 }}>{selectedProduct.brand || '-'} / {selectedProduct.unit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Harga Beli (Modal)</span>
                <span style={{ fontWeight: 500 }}>Rp {selectedProduct.buy_price.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Harga Jual</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>Rp {selectedProduct.sell_price.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Estimasi Margin/Keuntungan</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>Rp {(selectedProduct.sell_price - selectedProduct.buy_price).toLocaleString('id-ID')} per {selectedProduct.unit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Peringatan Stok Minimum</span>
                <span style={{ fontWeight: 500 }}>{selectedProduct.min_stock} {selectedProduct.unit}</span>
              </div>
            </div>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsDetailOpen(false)}>Tutup Detail</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
