import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Minus, Edit, Trash2, Eye } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/audit';

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
  const [chartData, setChartData] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailOpnameOpen, setIsDetailOpnameOpen] = useState(false);
  const [isDetailCurrentOpen, setIsDetailCurrentOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [selectedOpname, setSelectedOpname] = useState<any>(null);
  const [selectedCurrent, setSelectedCurrent] = useState<any>(null);
  const [modalType, setModalType] = useState<'in' | 'out'>('in');
  const [formData, setFormData] = useState({ 
    id: '', 
    product_id: '', 
    warehouse_id: '', 
    qty: 0, 
    ref_type: 'manual',
    sender_truck_plate: '',
    sender_driver_name: ''
  });
  const [opnames, setOpnames] = useState<any[]>([]);
  const [currentStock, setCurrentStock] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'saat_ini' | 'riwayat' | 'opname'>('saat_ini');
  const [formDataOpname, setFormDataOpname] = useState({ id: '', product_id: '', warehouse_id: '', system_qty: 0, physical_qty: 0, note: '' });
  const [searchQuery, setSearchQuery] = useState('');

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

    // Generate chart data for last 15 days
    const today = new Date();
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(today.getDate() - 14);
    const startDateStr = fifteenDaysAgo.toISOString().split('T')[0] + 'T00:00:00Z';

    const { data: chartMovements } = await supabase
      .from('stock_movements')
      .select('type, qty, created_at')
      .gte('created_at', startDateStr);

    if (chartMovements) {
      const days: { [key: string]: { date: string; masuk: number; keluar: number } } = {};
      for (let i = 0; i < 15; i++) {
        const d = new Date();
        d.setDate(today.getDate() - 14 + i);
        const dayStr = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        days[dayStr] = { date: label, masuk: 0, keluar: 0 };
      }

      chartMovements.forEach((m: any) => {
        const dayKey = m.created_at.split('T')[0];
        if (days[dayKey]) {
          if (m.type === 'in') {
            days[dayKey].masuk += Number(m.qty);
          } else {
            days[dayKey].keluar += Number(m.qty);
          }
        }
      });

      setChartData(Object.values(days));
    }

    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id || !formData.warehouse_id || formData.qty <= 0) return alert('Data tidak valid');
    
    try {
      const prodName = products.find(p => p.id === formData.product_id)?.name || 'Produk';
      const whName = warehouses.find(w => w.id === formData.warehouse_id)?.name || 'Gudang';
      const dirStr = modalType === 'in' ? 'masuk' : 'keluar';

      if (formData.id) {
        const { error } = await supabase.from('stock_movements').update({
          product_id: formData.product_id,
          warehouse_id: formData.warehouse_id,
          qty: formData.qty,
          type: modalType,
          sender_truck_plate: modalType === 'in' ? formData.sender_truck_plate : null,
          sender_driver_name: modalType === 'in' ? formData.sender_driver_name : null
        }).eq('id', formData.id);
        
        if (error) throw error;

        await logActivity(
          profile?.id,
          profile?.name,
          'UPDATE_STOCK_MOVEMENT',
          `Mengedit pergerakan stok manual: ${prodName} ${dirStr} sebanyak ${formData.qty} sak di ${whName}`
        );

        setIsModalOpen(false);
        fetchData();
      } else {
        const { error } = await supabase.from('stock_movements').insert([{
          product_id: formData.product_id,
          warehouse_id: formData.warehouse_id,
          qty: formData.qty,
          ref_type: formData.ref_type,
          type: modalType,
          created_by: profile?.id,
          sender_truck_plate: modalType === 'in' ? formData.sender_truck_plate : null,
          sender_driver_name: modalType === 'in' ? formData.sender_driver_name : null
        }]);

        if (error) throw error;

        const detailsSuffix = modalType === 'in' && formData.sender_driver_name
          ? ` (Supir: ${formData.sender_driver_name}, Truk: ${formData.sender_truck_plate || '-'})`
          : '';

        await logActivity(
          profile?.id,
          profile?.name,
          'CREATE_STOCK_MOVEMENT',
          `Mencatat penyesuaian stok manual: ${prodName} ${dirStr} sebanyak ${formData.qty} sak di ${whName}${detailsSuffix}`
        );

        setIsModalOpen(false);
        fetchData();
      }
    } catch (err: any) {
      alert('Gagal memproses stok: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus riwayat stok ini? Menghapus riwayat akan mempengaruhi total stok saat ini.')) return;
    
    try {
      const { error } = await supabase.from('stock_movements').delete().eq('id', id);
      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.name,
        'DELETE_STOCK_MOVEMENT',
        `Menghapus riwayat penyesuaian stok manual dengan ID: ${id}`
      );

      fetchData();
    } catch (err: any) {
      alert('Gagal menghapus riwayat: ' + err.message);
    }
  };

  const handleEdit = (m: any) => {
    setFormData({
      id: m.id,
      product_id: m.product_id,
      warehouse_id: m.warehouse_id,
      qty: m.qty,
      ref_type: m.ref_type || 'manual',
      sender_truck_plate: m.sender_truck_plate || '',
      sender_driver_name: m.sender_driver_name || ''
    });
    setModalType(m.type);
    setIsModalOpen(true);
  };

  const handleSaveOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    const prodName = products.find(p => p.id === formDataOpname.product_id)?.name || 'Produk';
    const whName = warehouses.find(w => w.id === formDataOpname.warehouse_id)?.name || 'Gudang';

    if (formDataOpname.id) {
      const { error } = await supabase.from('stock_opname').update({
        product_id: formDataOpname.product_id,
        warehouse_id: formDataOpname.warehouse_id,
        system_qty: formDataOpname.system_qty,
        physical_qty: formDataOpname.physical_qty,
        note: formDataOpname.note
      }).eq('id', formDataOpname.id);

      if (!error) {
        const diff = formDataOpname.physical_qty - formDataOpname.system_qty;
        if (diff !== 0) {
          // Check if movement exists
          const { data: existingMov } = await supabase.from('stock_movements').select('id').eq('ref_id', formDataOpname.id).single();
          if (existingMov) {
            await supabase.from('stock_movements').update({
              product_id: formDataOpname.product_id,
              warehouse_id: formDataOpname.warehouse_id,
              type: diff > 0 ? 'in' : 'out',
              qty: Math.abs(diff)
            }).eq('ref_id', formDataOpname.id);
          } else {
            await supabase.from('stock_movements').insert([{
              product_id: formDataOpname.product_id,
              warehouse_id: formDataOpname.warehouse_id,
              type: diff > 0 ? 'in' : 'out',
              qty: Math.abs(diff),
              ref_type: 'opname',
              ref_id: formDataOpname.id,
              created_by: profile?.id
            }]);
          }
        } else {
          await supabase.from('stock_movements').delete().eq('ref_id', formDataOpname.id);
        }

        await logActivity(
          profile?.id,
          profile?.name,
          'UPDATE_STOCK_OPNAME',
          `Mengedit Stock Opname: ${prodName} di ${whName}. Sistem: ${formDataOpname.system_qty}, Fisik: ${formDataOpname.physical_qty}`
        );

        setIsModalOpen(false);
        fetchData();
      } else {
        alert('Gagal mengupdate opname: ' + error.message);
      }
    } else {
      const { data: newOpname, error } = await supabase.from('stock_opname').insert([{
        product_id: formDataOpname.product_id,
        warehouse_id: formDataOpname.warehouse_id,
        system_qty: formDataOpname.system_qty,
        physical_qty: formDataOpname.physical_qty,
        note: formDataOpname.note,
        created_by: profile?.id
      }]).select().single();

      if (!error && newOpname) {
        const diff = formDataOpname.physical_qty - formDataOpname.system_qty;
        if (diff !== 0) {
          await supabase.from('stock_movements').insert([{
            product_id: formDataOpname.product_id,
            warehouse_id: formDataOpname.warehouse_id,
            type: diff > 0 ? 'in' : 'out',
            qty: Math.abs(diff),
            ref_type: 'opname',
            ref_id: newOpname.id,
            created_by: profile?.id
          }]);
        }

        await logActivity(
          profile?.id,
          profile?.name,
          'CREATE_STOCK_OPNAME',
          `Membuat Stock Opname Baru: ${prodName} di ${whName}. Sistem: ${formDataOpname.system_qty}, Fisik: ${formDataOpname.physical_qty} (Selisih: ${diff})`
        );

        setIsModalOpen(false);
        fetchData();
      } else if (error) {
        alert('Gagal menyimpan opname: ' + error.message);
      }
    }
  };

  const handleDeleteOpname = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus riwayat opname ini? Ini juga akan membatalkan penyesuaian stok terkait.')) return;
    
    try {
      await supabase.from('stock_movements').delete().eq('ref_id', id);
      const { error } = await supabase.from('stock_opname').delete().eq('id', id);
      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.name,
        'DELETE_STOCK_OPNAME',
        `Menghapus riwayat Stock Opname dengan ID: ${id}`
      );

      fetchData();
    } catch (err: any) {
      alert('Gagal menghapus opname: ' + err.message);
    }
  };

  const handleEditOpname = (op: any) => {
    setFormDataOpname({
      id: op.id,
      product_id: op.product_id,
      warehouse_id: op.warehouse_id,
      system_qty: op.system_qty,
      physical_qty: op.physical_qty,
      note: op.note || ''
    });
    setIsModalOpen(true);
  };

  const handleEditCurrent = (row: any) => {
    setFormDataOpname({
      id: '',
      product_id: row.product_id,
      warehouse_id: row.warehouse_id,
      system_qty: row.current_stock,
      physical_qty: row.current_stock,
      note: 'Penyesuaian manual dari stok saat ini'
    });
    setActiveTab('opname');
    setIsModalOpen(true);
  };

  const handleDeleteCurrent = async (row: any) => {
    if (!window.confirm(`Yakin ingin menghapus semua stok ${row.products?.name} di ${row.warehouses?.name}? Ini akan menghapus semua riwayat pergerakan stok untuk item ini.`)) return;
    
    // Hapus semua riwayat di gudang tsb untuk produk ini
    await supabase.from('stock_movements').delete().match({ product_id: row.product_id, warehouse_id: row.warehouse_id });
    await supabase.from('stock_opname').delete().match({ product_id: row.product_id, warehouse_id: row.warehouse_id });
    fetchData();
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
              <button className="btn btn-primary" onClick={() => { 
                setFormData({ id: '', product_id: products[0]?.id || '', warehouse_id: warehouses[0]?.id || '', qty: 0, ref_type: 'manual', sender_truck_plate: '', sender_driver_name: '' });
                setModalType('in'); 
                setIsModalOpen(true); 
              }} style={{ display: 'flex', gap: '0.5rem' }}>
                <Plus size={18} /> Terima dari PT Ris Investindo
              </button>
              <button className="btn" onClick={() => { 
                setFormData({ id: '', product_id: products[0]?.id || '', warehouse_id: warehouses[0]?.id || '', qty: 0, ref_type: 'manual', sender_truck_plate: '', sender_driver_name: '' });
                setModalType('out'); 
                setIsModalOpen(true); 
              }} style={{ backgroundColor: 'var(--warning)', color: 'white', display: 'flex', gap: '0.5rem' }}>
                <Minus size={18} /> Stok Keluar
              </button>
            </div>
          </div>
          <div className="mobile-tabs-scroll" style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`btn ${activeTab === 'saat_ini' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('saat_ini')} style={{ backgroundColor: activeTab !== 'saat_ini' ? 'var(--bg-secondary)' : undefined, color: activeTab !== 'saat_ini' ? 'var(--text-primary)' : undefined }}>Stok Saat Ini</button>
            <button className={`btn ${activeTab === 'riwayat' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('riwayat')} style={{ backgroundColor: activeTab !== 'riwayat' ? 'var(--bg-secondary)' : undefined, color: activeTab !== 'riwayat' ? 'var(--text-primary)' : undefined }}>Riwayat (Kartu Stok)</button>
            <button className={`btn ${activeTab === 'opname' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('opname')} style={{ backgroundColor: activeTab !== 'opname' ? 'var(--bg-secondary)' : undefined, color: activeTab !== 'opname' ? 'var(--text-primary)' : undefined }}>Stok Opname</button>
          </div>
        </header>

        <div style={{ marginBottom: '0.75rem' }}>
          <input type="text" className="input-field" placeholder="🔍 Cari berdasarkan nama produk atau gudang..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ maxWidth: '400px' }} />
        </div>

        {activeTab === 'saat_ini' && chartData.length > 0 && (
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Grafik Tren Aktivitas Stok (15 Hari Terakhir)
            </h3>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMasuk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorKeluar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                  <Area type="monotone" dataKey="masuk" name="Stok Masuk" stroke="var(--success)" fillOpacity={1} fill="url(#colorMasuk)" strokeWidth={2} />
                  <Area type="monotone" dataKey="keluar" name="Stok Keluar" stroke="var(--danger)" fillOpacity={1} fill="url(#colorKeluar)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

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
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentStock.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada data stok barang.</td></tr>
                ) : currentStock.filter(row =>
                  row.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  row.warehouses?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{row.products?.name}</td>
                    <td style={{ padding: '1rem' }}>{row.warehouses?.name}</td>
                    <td style={{ padding: '1rem', fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary-color)' }}>{row.current_stock}</td>
                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn" onClick={() => { setSelectedCurrent(row); setIsDetailCurrentOpen(true); }} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} title="Detail">
                        <Eye size={16} />
                      </button>
                      <button className="btn" onClick={() => handleEditCurrent(row)} style={{ padding: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} title="Edit (Opname)">
                        <Edit size={16} />
                      </button>
                      <button className="btn" onClick={() => handleDeleteCurrent(row)} style={{ padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }} title="Hapus Semua Riwayat">
                        <Trash2 size={16} />
                      </button>
                    </td>
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
                  <th style={{ padding: '1rem' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {movements.filter(m =>
                  m.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  m.warehouses?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((m) => (
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
                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" onClick={() => { setSelectedMovement(m); setIsDetailOpen(true); }} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} title="Detail">
                        <Eye size={16} />
                      </button>
                      <button className="btn" onClick={() => handleEdit(m)} style={{ padding: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} title="Edit">
                        <Edit size={16} />
                      </button>
                      <button className="btn" onClick={() => handleDelete(m.id)} style={{ padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }} title="Hapus">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>
              <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Riwayat Stok Opname</h2>
                <button className="btn btn-primary" onClick={() => { 
                  setFormDataOpname({ id: '', product_id: products[0]?.id || '', warehouse_id: warehouses[0]?.id || '', system_qty: 0, physical_qty: 0, note: '' });
                  setIsModalOpen(true); 
                }} style={{ fontSize: '0.875rem' }}>+ Buat Opname</button>
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
                    <th style={{ padding: '1rem' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {opnames.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada data opname.</td></tr>
                  ) : opnames.filter(op =>
                    op.products?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    op.warehouses?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((op) => (
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
                      <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <button className="btn" onClick={() => { setSelectedOpname(op); setIsDetailOpnameOpen(true); }} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} title="Detail">
                          <Eye size={16} />
                        </button>
                        <button className="btn" onClick={() => handleEditOpname(op)} style={{ padding: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} title="Edit">
                          <Edit size={16} />
                        </button>
                        <button className="btn" onClick={() => handleDeleteOpname(op.id)} style={{ padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }} title="Hapus">
                          <Trash2 size={16} />
                        </button>
                      </td>
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{activeTab === 'opname' ? (formDataOpname.id ? 'Edit Stok Opname' : 'Input Stok Opname') : formData.id ? 'Edit Riwayat Stok' : modalType === 'in' ? 'Penerimaan dari PT Ris Investindo' : 'Input Stok Keluar'}</h2>
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
                {modalType === 'in' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group">
                      <label className="input-label">Nama Supir Pengirim</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={formData.sender_driver_name} 
                        onChange={e => setFormData({...formData, sender_driver_name: e.target.value})} 
                        placeholder="Misal: Budi" 
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Plat Nomor Truk Pengirim</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={formData.sender_truck_plate} 
                        onChange={e => setFormData({...formData, sender_truck_plate: e.target.value})} 
                        placeholder="Misal: BK 1234 AB" 
                      />
                    </div>
                  </div>
                )}
                <div className="input-group">
                  <label className="input-label">Total Semen {modalType === 'in' ? 'Masuk' : 'Keluar'} (Jumlah Sak)</label>
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

      {isDetailOpen && selectedMovement && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Detail Riwayat Stok</h2>
              <button className="btn" onClick={() => setIsDetailOpen(false)} style={{ padding: '0.25rem' }}>Tutup</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Waktu</span>
                <span style={{ fontWeight: 600 }}>{new Date(selectedMovement.created_at).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Produk</span>
                <span style={{ fontWeight: 600 }}>{selectedMovement.products?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Gudang</span>
                <span style={{ fontWeight: 600 }}>{selectedMovement.warehouses?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Jenis Mutasi</span>
                <span style={{ 
                  fontWeight: 600, 
                  color: selectedMovement.type === 'in' ? 'var(--success)' : 'var(--danger)' 
                }}>
                  {selectedMovement.type === 'in' ? 'MASUK' : 'KELUAR'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Jumlah</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{selectedMovement.qty} sak</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Referensi</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{selectedMovement.ref_type?.replace('_', ' ')}</span>
              </div>
              {selectedMovement.type === 'in' && selectedMovement.sender_driver_name && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Supir Pengirim</span>
                    <span style={{ fontWeight: 600 }}>{selectedMovement.sender_driver_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Plat Truk Pengirim</span>
                    <span style={{ fontWeight: 600 }}>{selectedMovement.sender_truck_plate || '-'}</span>
                  </div>
                </>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsDetailOpen(false)}>Tutup Detail</button>
            </div>
          </div>
        </div>
      )}

      {isDetailOpnameOpen && selectedOpname && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Detail Stok Opname</h2>
              <button className="btn" onClick={() => setIsDetailOpnameOpen(false)} style={{ padding: '0.25rem' }}>Tutup</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tanggal Opname</span>
                <span style={{ fontWeight: 600 }}>{new Date(selectedOpname.date).toLocaleDateString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Produk</span>
                <span style={{ fontWeight: 600 }}>{selectedOpname.products?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Gudang</span>
                <span style={{ fontWeight: 600 }}>{selectedOpname.warehouses?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Stok Sistem</span>
                <span style={{ fontWeight: 600 }}>{selectedOpname.system_qty} sak</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Stok Fisik Aktual</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{selectedOpname.physical_qty} sak</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Selisih</span>
                <span style={{ 
                  fontWeight: 700, 
                  color: selectedOpname.physical_qty - selectedOpname.system_qty < 0 ? 'var(--danger)' : selectedOpname.physical_qty - selectedOpname.system_qty > 0 ? 'var(--success)' : 'inherit' 
                }}>
                  {selectedOpname.physical_qty - selectedOpname.system_qty > 0 ? '+' : ''}{selectedOpname.physical_qty - selectedOpname.system_qty}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Keterangan</span>
                <span style={{ fontWeight: 500, lineHeight: 1.5 }}>{selectedOpname.note || '-'}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsDetailOpnameOpen(false)}>Tutup Detail</button>
            </div>
          </div>
        </div>
      )}

      {isDetailCurrentOpen && selectedCurrent && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Detail Stok Saat Ini</h2>
              <button className="btn" onClick={() => setIsDetailCurrentOpen(false)} style={{ padding: '0.25rem' }}>Tutup</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Produk</span>
                <span style={{ fontWeight: 600 }}>{selectedCurrent.products?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Lokasi Gudang</span>
                <span style={{ fontWeight: 600 }}>{selectedCurrent.warehouses?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Sisa Stok</span>
                <span style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--primary-color)' }}>{selectedCurrent.current_stock} sak</span>
              </div>
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Catatan:</strong> Stok saat ini adalah hasil perhitungan otomatis dari seluruh riwayat barang masuk, keluar, dan opname (penyesuaian). Untuk mengubah nilai ini secara manual, silakan gunakan fitur <strong>Edit</strong> yang akan membuat penyesuaian opname baru.
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsDetailCurrentOpen(false)}>Tutup Detail</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
