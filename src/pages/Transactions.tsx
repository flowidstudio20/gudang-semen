import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Eye, CheckCircle, XCircle, Camera, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/audit';

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const [formData, setFormData] = useState({
    customer_id: '',
    warehouse_id: '',
    product_id: '',
    qty: 1,
    price: 0,
    payment_type: 'cash'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.product_id || formData.qty <= 0) {
      showToast('Data tidak lengkap atau jumlah tidak valid', 'error');
      return;
    }
    if (!receiptFile) {
      showToast('WAJIB melampirkan Foto Bukti Penjualan!', 'error');
      return;
    }
    
    try {
      setUploading(true);
      let receiptUrl = null;

      // Upload Foto Bukti (jika ada)
      if (receiptFile) {
        let fileExt = receiptFile.name.includes('.') ? receiptFile.name.split('.').pop() : '';
        if (!fileExt) {
          fileExt = receiptFile.type.split('/')[1] || 'jpg';
        }
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

      const custName = customers.find(c => c.id === formData.customer_id)?.name || 'Pelanggan';
      await logActivity(
        profile?.id,
        profile?.name,
        'CREATE_SALES_ORDER',
        `Membuat draf pesanan penjualan baru untuk pelanggan ${custName} senilai Rp ${(formData.qty * formData.price).toLocaleString('id-ID')}`
      );

      setIsModalOpen(false);
      setUploading(false);
      fetchData();
      showToast('Penjualan berhasil dibuat (menunggu persetujuan)!');
    } catch (err: any) {
      setUploading(false);
      showToast('Gagal membuat penjualan: ' + err.message, 'error');
    }
  };

  const handleApprove = async () => {
    if (!selectedOrder) return;
    
    const item = selectedOrder.sales_order_items[0];
    const totalAmount = item.qty * item.price;
    
    // Cek Stok
    const stock = stockSummary.find(s => s.product_id === item.product_id && s.warehouse_id === selectedOrder.warehouse_id)?.current_stock || 0;
    if (item.qty > stock) {
      showToast(`Stok tidak mencukupi! Sisa stok saat ini hanya ${stock} sak.`, 'error');
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

      await logActivity(
        profile?.id,
        profile?.name,
        'APPROVE_SALES_ORDER',
        `Menyetujui penjualan SO #${selectedOrder.id.split('-')[0].toUpperCase()} untuk pelanggan ${selectedOrder.customers?.name} senilai Rp ${totalAmount.toLocaleString('id-ID')} dan memotong stok.`
      );

      setIsDetailOpen(false);
      fetchData();
      showToast('Penjualan berhasil disetujui!');
    } catch (err: any) {
      showToast('Terjadi kesalahan saat menyetujui: ' + err.message, 'error');
    }
  };

  const handleReject = async () => {
    if (!selectedOrder) return;
    if (!window.confirm('Yakin ingin menolak penjualan ini?')) return;
    
    try {
      await supabase.from('sales_orders').update({ status: 'cancelled' }).eq('id', selectedOrder.id);

      await logActivity(
        profile?.id,
        profile?.name,
        'REJECT_SALES_ORDER',
        `Menolak dan membatalkan pesanan penjualan SO #${selectedOrder.id.split('-')[0].toUpperCase()} untuk pelanggan ${selectedOrder.customers?.name}`
      );

      setIsDetailOpen(false);
      fetchData();
      showToast('Penjualan berhasil ditolak!');
    } catch (err: any) {
      showToast('Gagal menolak: ' + err.message, 'error');
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

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input type="text" className="input-field" placeholder="🔍 Cari berdasarkan nama pelanggan..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ maxWidth: '300px', flex: 1 }} />
          <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: '200px' }}>
            <option value="all">Semua Status</option>
            <option value="draft">Menunggu Persetujuan</option>
            <option value="confirmed">Disetujui</option>
            <option value="cancelled">Ditolak</option>
          </select>
        </div>

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
                {salesOrders.length === 0 ? <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada penjualan.</td></tr> : salesOrders.filter(so => {
                  const matchSearch = !searchQuery || so.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchStatus = filterStatus === 'all' || so.status === filterStatus;
                  return matchSearch && matchStatus;
                }).map((so) => {
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => {
                  const printContent = document.getElementById('print-invoice');
                  if (printContent) {
                    printContent.style.display = 'block';
                    window.print();
                    setTimeout(() => { printContent.style.display = 'none'; }, 500);
                  }
                }} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>🖨 Cetak Nota</button>
                
                <button className="btn" onClick={() => {
                  const cust = selectedOrder.customers;
                  const item = selectedOrder.sales_order_items?.[0];
                  const total = selectedOrder.sales_order_items?.reduce((acc: number, i: any) => acc + (i.qty * i.price), 0) || 0;
                  const phone = cust?.contact || '';
                  const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '62');
                  const message = `Halo ${cust?.name},\n\nTerima kasih telah berbelanja di PT RIS INVESTINDO.\n\nBerikut rincian nota pembelian Anda:\nTanggal: ${new Date(selectedOrder.created_at).toLocaleDateString('id-ID')}\nPembayaran: ${selectedOrder.payment_type.toUpperCase()}\n\nItem:\n- ${item?.products?.name} (${item?.qty} sak) @ Rp ${item?.price.toLocaleString('id-ID')}\nTotal: Rp ${total.toLocaleString('id-ID')}\n\nNota digital ini adalah bukti transaksi yang sah. Terima kasih!`;
                  window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
                }} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', backgroundColor: '#128C7E', color: 'white' }}>
                  💬 Kirim WA
                </button>

                <button className="btn btn-primary" onClick={() => setIsDetailOpen(false)}>Tutup</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden Print Invoice */}
      {selectedOrder && (
        <div id="print-invoice" className="print-only" style={{ display: 'none' }}>
          <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '400px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>PT RIS INVESTINDO</h2>
              <p style={{ margin: '0.25rem 0', fontSize: '0.8rem' }}>NOTA PENJUALAN SEMEN</p>
              <p style={{ margin: 0, fontSize: '0.7rem' }}>Tanggal: {new Date(selectedOrder.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              <p><strong>Pelanggan:</strong> {selectedOrder.customers?.name}</p>
              <p><strong>Pembayaran:</strong> {selectedOrder.payment_type === 'cash' ? 'Tunai' : 'Kredit'}</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0' }}>Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Harga</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.sales_order_items?.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ padding: '0.3rem 0' }}>{item.products?.name}</td>
                    <td style={{ textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right' }}>Rp {item.price?.toLocaleString('id-ID')}</td>
                    <td style={{ textAlign: 'right' }}>Rp {(item.qty * item.price)?.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: '2px dashed #000', paddingTop: '0.75rem', textAlign: 'right', fontSize: '1rem', fontWeight: 'bold' }}>
              TOTAL: Rp {selectedOrder.sales_order_items?.reduce((acc: number, i: any) => acc + (i.qty * i.price), 0)?.toLocaleString('id-ID')}
            </div>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <div style={{ textAlign: 'center' }}><p>Pengirim</p><br/><br/><p>____________</p></div>
              <div style={{ textAlign: 'center' }}><p>Penerima</p><br/><br/><p>____________</p></div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10000,
          fontWeight: 600,
          fontSize: '0.9rem',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {toast.message}
        </div>
      )}
    </Layout>
  );
}
