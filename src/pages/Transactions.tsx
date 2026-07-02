import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Eye, CheckCircle, XCircle, Camera, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Transactions() {
  const { profile } = useAuth();
  
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_id: '',
    warehouse_id: '',
    product_id: '',
    qty: 1,
    price: 0,
    payment_type: 'cash'
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [soRes, custRes, prodRes, whRes, stockRes] = await Promise.all([
      supabase.from('sales_orders').select('*, customers(name), warehouses(name), sales_order_items(product_id, qty, price, products(name))').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name'),
      supabase.from('products').select('id, name, sell_price'),
      supabase.from('warehouses').select('id, name'),
      supabase.from('stock_summary').select('product_id, warehouse_id, current_stock')
    ]);
    
    if (soRes.data) setSalesOrders(soRes.data);
    if (custRes.data) setCustomers(custRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    if (stockRes.data) setStockSummary(stockRes.data);
    if (whRes.data) {
      setWarehouses(whRes.data);
      if (whRes.data[0]) setFormData(f => ({ ...f, warehouse_id: whRes.data[0].id }));
    }
    setLoading(false);
  };

  const handleOpenModal = () => {
    setFormData(f => ({
      ...f,
      customer_id: customers[0]?.id || '',
      product_id: products[0]?.id || '',
      price: products[0]?.sell_price || 0
    }));
    setReceiptFile(null);
    setIsModalOpen(true);
  };

  const handleProductChange = (e: any) => {
    const pid = e.target.value;
    const prod = products.find(p => p.id === pid);
    setFormData({ ...formData, product_id: pid, price: prod?.sell_price || 0 });
  };

  // Submit Penjualan Baru -> Status Draft (Request)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.product_id || formData.qty <= 0) return alert('Data tidak lengkap atau jumlah tidak valid');
    if (!receiptFile) return alert('WAJIB melampirkan Foto Bukti Penjualan!');
    
    try {
      setUploading(true);
      let receiptUrl = null;

      // Upload Foto Bukti (jika ada)
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('bukti penjualan')
          .upload(fileName, receiptFile);

        if (uploadError) {
          throw new Error('Gagal upload foto: ' + uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from('bukti penjualan')
          .getPublicUrl(fileName);
        
        receiptUrl = urlData.publicUrl;
      }

      // 1. Insert SO dengan status 'draft'
      const { data: so, error: soError } = await supabase.from('sales_orders').insert([{
        customer_id: formData.customer_id, 
        warehouse_id: formData.warehouse_id, 
        payment_type: formData.payment_type, 
        status: 'draft', 
        created_by: profile?.id,
        receipt_image: receiptUrl
      }]).select().single();
      if (soError) throw soError;

      // 2. Insert SO Item
      await supabase.from('sales_order_items').insert([{ 
        so_id: so.id, 
        product_id: formData.product_id, 
        qty: formData.qty, 
        price: formData.price 
      }]);

      setIsModalOpen(false);
      setUploading(false);
      fetchData();
    } catch (err: any) {
      setUploading(false);
      alert('Gagal membuat penjualan: ' + err.message);
    }
  };

  const handleApprove = async () => {
    if (!selectedOrder) return;
    
    const item = selectedOrder.sales_order_items[0];
    const totalAmount = item.qty * item.price;
    
    // Cek Stok
    const stock = stockSummary.find(s => s.product_id === item.product_id && s.warehouse_id === selectedOrder.warehouse_id)?.current_stock || 0;
    if (item.qty > stock) {
      alert(`Stok tidak mencukupi! Sisa stok saat ini hanya ${stock} sak.`);
      return;
    }

    try {
      // 1. Update status SO ke confirmed
      await supabase.from('sales_orders').update({ status: 'confirmed' }).eq('id', selectedOrder.id);
      
      // 2. Potong Stok
      await supabase.from('stock_movements').insert([{
        product_id: item.product_id, 
        warehouse_id: selectedOrder.warehouse_id, 
        type: 'out', 
        qty: item.qty, 
        ref_type: 'sales_order', 
        ref_id: selectedOrder.id, 
        created_by: profile?.id
      }]);

      // 3. Create Piutang if Kredit
      if (selectedOrder.payment_type === 'kredit') {
        await supabase.from('receivables').insert([{ 
          customer_id: selectedOrder.customer_id, 
          so_id: selectedOrder.id, 
          amount: totalAmount, 
          status: 'unpaid' 
        }]);
      }

      setIsDetailOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Terjadi kesalahan saat menyetujui: ' + err.message);
    }
  };

  const handleReject = async () => {
    if (!selectedOrder) return;
    if (!window.confirm('Yakin ingin menolak penjualan ini?')) return;
    
    try {
      await supabase.from('sales_orders').update({ status: 'cancelled' }).eq('id', selectedOrder.id);
      setIsDetailOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Gagal menolak: ' + err.message);
    }
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Penjualan</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Catat order penjualan semen ke pelanggan (SO).</p>
            </div>
            <button className="btn btn-primary" onClick={handleOpenModal} style={{ display: 'flex', gap: '0.5rem' }}>
              <Plus size={18} /> Catat Penjualan Baru
            </button>
          </div>
        </header>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center' }}>Memuat data...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Tgl Order</th>
                  <th style={{ padding: '1rem' }}>Pelanggan</th>
                  <th style={{ padding: '1rem' }}>Gudang</th>
                  <th style={{ padding: '1rem' }}>Total Tagihan</th>
                  <th style={{ padding: '1rem' }}>Tipe Bayar</th>
                  <th style={{ padding: '1rem' }}>Status Penjualan</th>
                  <th style={{ padding: '1rem' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {salesOrders.length === 0 ? <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada penjualan.</td></tr> : salesOrders.map((so) => {
                  const total = so.sales_order_items?.reduce((acc: number, item: any) => acc + (item.qty * item.price), 0) || 0;
                  return (
                    <tr key={so.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem' }}>{new Date(so.created_at).toLocaleDateString('id-ID')}</td>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{so.customers?.name}</td>
                      <td style={{ padding: '1rem' }}>{so.warehouses?.name}</td>
                      <td style={{ padding: '1rem', fontWeight: 700 }}>Rp {total.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '1rem', textTransform: 'capitalize' }}>
                        <span style={{ color: so.payment_type === 'kredit' ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>{so.payment_type}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          backgroundColor: so.status === 'draft' ? 'rgba(245, 158, 11, 0.1)' : so.status === 'cancelled' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                          color: so.status === 'draft' ? 'var(--warning)' : so.status === 'cancelled' ? 'var(--danger)' : 'var(--success)'
                        }}>
                          {so.status === 'draft' ? 'MENUNGGU PERSETUJUAN' : so.status === 'cancelled' ? 'DITOLAK' : 'DISETUJUI'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button className="btn" onClick={() => { setSelectedOrder(so); setIsDetailOpen(true); }} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                          <Eye size={16} /> Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL INPUT PENJUALAN */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Catat Penjualan Baru</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)} style={{ padding: '0.25rem' }}>Tutup</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="input-group">
                <label className="input-label">Pelanggan / Toko</label>
                <select className="input-field" value={formData.customer_id} onChange={e => setFormData({...formData, customer_id: e.target.value})}>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Keluar dari Gudang</label>
                <select className="input-field" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})}>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Detail Pesanan</h3>
                <div className="input-group">
                  <label className="input-label">Produk Semen</label>
                  <select className="input-field" value={formData.product_id} onChange={handleProductChange}>
                    {products.map(p => {
                      const stock = stockSummary.find(s => s.product_id === p.id && s.warehouse_id === formData.warehouse_id)?.current_stock || 0;
                      return <option key={p.id} value={p.id}>{p.name} (Sisa: {stock})</option>;
                    })}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Jumlah (Sak)</label>
                    <input required type="text" className="input-field" value={formData.qty} onChange={e => setFormData({...formData, qty: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Harga Satuan</label>
                    <input required type="number" className="input-field" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Tipe Pembayaran</label>
                <select className="input-field" value={formData.payment_type} onChange={e => setFormData({...formData, payment_type: e.target.value})}>
                  <option value="cash">Tunai (Cash / Lunas)</option>
                  <option value="kredit">Kredit (Tempo / Bon)</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ color: 'var(--danger)', fontWeight: 600 }}>WAJIB Lampirkan Foto Bukti Pesanan/Resi</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                  {receiptFile ? (
                    <div style={{ position: 'relative', width: '100%', height: '200px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--primary-color)' }}>
                      <img src={URL.createObjectURL(receiptFile)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        type="button" 
                        onClick={() => setReceiptFile(null)} 
                        style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                      >
                        <XCircle size={20} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>
                        <Camera size={32} style={{ color: 'var(--primary-color)' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Buka Kamera</span>
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>
                        <ImageIcon size={32} style={{ color: 'var(--success)' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Pilih dari Galeri</span>
                        <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} disabled={uploading}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Mengupload & Menyimpan...' : 'Ajukan Penjualan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL & APPROVAL */}
      {isDetailOpen && selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Detail Penjualan</h2>
              <button className="btn" onClick={() => setIsDetailOpen(false)} style={{ padding: '0.25rem' }}>Tutup</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pelanggan</span>
                <span style={{ fontWeight: 600 }}>{selectedOrder.customers?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Item & Jumlah</span>
                <span style={{ fontWeight: 600, textAlign: 'right' }}>
                  {selectedOrder.sales_order_items?.map((i: any) => `${i.products?.name} (${i.qty} sak)`).join(', ')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Harga</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>
                  Rp {(selectedOrder.sales_order_items?.[0]?.qty * selectedOrder.sales_order_items?.[0]?.price).toLocaleString('id-ID')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tipe Pembayaran</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{selectedOrder.payment_type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status Saat Ini</span>
                <span style={{ fontWeight: 700, color: selectedOrder.status === 'draft' ? 'var(--warning)' : selectedOrder.status === 'cancelled' ? 'var(--danger)' : 'var(--success)' }}>
                  {selectedOrder.status === 'draft' ? 'MENUNGGU PERSETUJUAN' : selectedOrder.status === 'cancelled' ? 'DITOLAK' : 'DISETUJUI (SIAP KIRIM)'}
                </span>
              </div>
              {selectedOrder.receipt_image && (
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Bukti Foto:</span>
                  <img src={selectedOrder.receipt_image} alt="Bukti" style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: 'var(--radius-md)', backgroundColor: '#000' }} />
                </div>
              )}
            </div>

            {selectedOrder.status === 'draft' && (profile?.role === 'admin' || profile?.role === 'kepala_gudang') ? (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn" onClick={handleReject} style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <XCircle size={18} /> Tolak Penjualan
                </button>
                <button className="btn btn-primary" onClick={handleApprove} style={{ flex: 1, backgroundColor: 'var(--success)', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <CheckCircle size={18} /> Setujui & Potong Stok
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => setIsDetailOpen(false)}>Tutup Detail</button>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
