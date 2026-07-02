import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Printer, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DeliveryNotes() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({ so_id: '', vehicle_id: '', driver_id: '' });

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    const [noteRes, soRes, vhRes, drRes] = await Promise.all([
      supabase.from('delivery_notes').select('*, sales_orders(created_at, customers(name)), vehicles(plate_number), drivers(name)'),
      supabase.from('sales_orders').select('id, created_at, customers(name)').eq('status', 'confirmed'),
      supabase.from('vehicles').select('id, plate_number, status'),
      supabase.from('drivers').select('id, name')
    ]);
    
    if (noteRes.data) setNotes(noteRes.data);
    if (soRes.data) setSalesOrders(soRes.data);
    if (vhRes.data) setVehicles(vhRes.data);
    if (drRes.data) setDrivers(drRes.data);
    
    if (soRes.data?.[0]) setFormData(f => ({ ...f, so_id: soRes.data[0].id }));
    if (vhRes.data?.[0]) setFormData(f => ({ ...f, vehicle_id: vhRes.data[0].id }));
    if (drRes.data?.[0]) setFormData(f => ({ ...f, driver_id: drRes.data[0].id }));
    
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalSO = formData.so_id;
    let finalVehicle = formData.vehicle_id;
    let finalDriver = formData.driver_id;
    
    if (!finalSO && salesOrders.length > 0) finalSO = salesOrders[0].id;
    if (!finalVehicle && vehicles.length > 0) finalVehicle = vehicles[0].id;
    if (!finalDriver && drivers.length > 0) finalDriver = drivers[0].id;

    if (!finalSO || !finalVehicle || !finalDriver) return alert('Data belum lengkap (Pastikan ada SO, Truk, dan Supir)');
    
    try {
      const { error } = await supabase.from('delivery_notes').insert([{
        so_id: finalSO,
        vehicle_id: finalVehicle,
        driver_id: finalDriver,
        status: 'pending',
        created_by: profile?.id
      }]);

      if (error) throw error;

      await supabase.from('vehicles').update({ status: 'in_use' }).eq('id', finalVehicle);
      
      setIsModalOpen(false);
      fetchNotes();
      setFormData({ so_id: '', vehicle_id: '', driver_id: '' }); // reset form
    } catch (err: any) {
      alert('Gagal membuat surat jalan: ' + err.message);
    }
  };

  const updateStatus = async (id: string, newStatus: string, vh_id: string) => {
    const payload: any = { status: newStatus };
    if (newStatus === 'on_the_way') payload.sent_at = new Date().toISOString();
    if (newStatus === 'delivered') payload.received_at = new Date().toISOString();
    
    await supabase.from('delivery_notes').update(payload).eq('id', id);
    
    // If delivered, set vehicle back to available
    if (newStatus === 'delivered') {
      await supabase.from('vehicles').update({ status: 'available' }).eq('id', vh_id);
    }
    fetchNotes();
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header className="flex-between" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Surat Jalan (Pengiriman)</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Pantau dan kelola status pengiriman.</p>
          </div>
          {profile?.role !== 'supir_kasir' && (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', gap: '0.5rem' }}>
              <Plus size={18} /> Buat Surat Jalan
            </button>
          )}
        </header>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center' }}>Memuat data...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>ID Surat / Tgl SO</th>
                  <th style={{ padding: '1rem' }}>Pelanggan</th>
                  <th style={{ padding: '1rem' }}>Supir</th>
                  <th style={{ padding: '1rem' }}>Truk (Plat)</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {notes.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada surat jalan.</td></tr>
                ) : notes.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.id.split('-')[0]}</span><br/>
                      {new Date(row.sales_orders?.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{row.sales_orders?.customers?.name}</td>
                    <td style={{ padding: '1rem' }}>{row.drivers?.name}</td>
                    <td style={{ padding: '1rem' }}>{row.vehicles?.plate_number}</td>
                    <td style={{ padding: '1rem' }}>
                      <select 
                        value={row.status} 
                        onChange={(e) => updateStatus(row.id, e.target.value, row.vehicle_id)}
                        disabled={row.status === 'delivered'}
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="loading">Loading</option>
                        <option value="on_the_way">On The Way</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button className="btn" onClick={() => window.print()} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)' }}>
                        <Printer size={16} />
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Buat Surat Jalan Baru</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)} style={{ padding: '0.25rem' }}>Tutup</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="input-group">
                <label className="input-label">Pilih Sales Order (SO)</label>
                <select className="input-field" value={formData.so_id} onChange={e => setFormData({...formData, so_id: e.target.value})}>
                  {salesOrders.length === 0 && <option value="">Tidak ada SO terkonfirmasi</option>}
                  {salesOrders.map(s => <option key={s.id} value={s.id}>{new Date(s.created_at).toLocaleDateString('id-ID')} - {s.customers?.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Tugaskan Supir</label>
                <select className="input-field" value={formData.driver_id} onChange={e => setFormData({...formData, driver_id: e.target.value})}>
                  {drivers.length === 0 && <option value="">Belum ada supir terdaftar</option>}
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Pilih Truk</label>
                <select className="input-field" value={formData.vehicle_id} onChange={e => setFormData({...formData, vehicle_id: e.target.value})}>
                  {vehicles.length === 0 && <option value="">Tidak ada truk terdaftar</option>}
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} {v.status === 'in_use' ? '(Sedang Jalan)' : v.status === 'maintenance' ? '(Perbaikan)' : ''}</option>)}
                </select>
              </div>
              
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={salesOrders.length === 0 || vehicles.length === 0 || drivers.length === 0}>Buat Surat Jalan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
