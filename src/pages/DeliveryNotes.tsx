import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Printer, Eye, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/audit';

export default function DeliveryNotes() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({ so_id: '', vehicle_id: '', driver_id: '' });
  const [filterStatus, setFilterStatus] = useState('all');
  const [printNote, setPrintNote] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    const [noteRes, soRes, vhRes, drRes] = await Promise.all([
      supabase.from('delivery_notes').select('*, sales_orders(created_at, customers(name, address, contact), sales_order_items(qty, products(name))), vehicles(plate_number), drivers(name)'),
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
      
      const drvName = drivers.find(d => d.id === finalDriver)?.name || 'Supir';
      const vehPlate = vehicles.find(v => v.id === finalVehicle)?.plate_number || 'Truk';
      await logActivity(
        profile?.id,
        profile?.name,
        'CREATE_DELIVERY_NOTE',
        `Membuat Surat Jalan pengiriman baru. Supir: ${drvName}, Truk: ${vehPlate}, untuk SO ID: ${finalSO.split('-')[0].toUpperCase()}`
      );

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
    
    try {
      await supabase.from('delivery_notes').update(payload).eq('id', id);
      
      // If delivered, set vehicle back to available
      if (newStatus === 'delivered') {
        await supabase.from('vehicles').update({ status: 'available' }).eq('id', vh_id);
      }

      await logActivity(
        profile?.id,
        profile?.name,
        'UPDATE_DELIVERY_NOTE_STATUS',
        `Mengubah status Surat Jalan #${id.split('-')[0].toUpperCase()} menjadi ${newStatus.toUpperCase()}`
      );

      fetchNotes();
    } catch (err: any) {
      alert('Gagal memperbarui status: ' + err.message);
    }
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

        <div style={{ marginBottom: '1rem' }}>
          <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: '200px' }}>
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="loading">Loading</option>
            <option value="on_the_way">On The Way</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

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
                ) : notes.filter(row => filterStatus === 'all' || row.status === filterStatus).map((row) => (
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
                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" onClick={() => { setSelectedNote(row); setIsDetailOpen(true); }} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        <Eye size={16} />
                      </button>
                      <button className="btn" onClick={() => {
                        setPrintNote(row);
                        setTimeout(() => { window.print(); }, 200);
                      }} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)' }}>
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

      {/* Printable Surat Jalan */}
      {printNote && (
        <div id="print-surat-jalan" className="print-only">
          <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>PT RIS INVESTINDO</h2>
              <h3 style={{ margin: '0.5rem 0', letterSpacing: '0.1em' }}>SURAT JALAN</h3>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>No: {printNote.id?.split('-')[0]?.toUpperCase()}</p>
            </div>
            <table style={{ width: '100%', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <tbody>
                <tr><td style={{ padding: '0.3rem 0', width: '35%' }}>Tanggal</td><td>: {new Date(printNote.created_at || printNote.sales_orders?.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
                <tr><td style={{ padding: '0.3rem 0' }}>Pelanggan</td><td>: {printNote.sales_orders?.customers?.name}</td></tr>
                <tr><td style={{ padding: '0.3rem 0' }}>Supir</td><td>: {printNote.drivers?.name}</td></tr>
                <tr><td style={{ padding: '0.3rem 0' }}>No. Polisi</td><td>: {printNote.vehicles?.plate_number}</td></tr>
              </tbody>
            </table>
            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '0.75rem 0', marginBottom: '2rem', fontSize: '0.85rem' }}>
              <p>Barang yang dikirim sesuai dengan Sales Order terkait.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', fontSize: '0.8rem' }}>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <p>Pengirim</p><br/><br/><br/>
                <p style={{ borderTop: '1px solid #000', paddingTop: '0.25rem' }}>(_____________)</p>
              </div>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <p>Supir</p><br/><br/><br/>
                <p style={{ borderTop: '1px solid #000', paddingTop: '0.25rem' }}>{printNote.drivers?.name}</p>
              </div>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <p>Penerima</p><br/><br/><br/>
                <p style={{ borderTop: '1px solid #000', paddingTop: '0.25rem' }}>(_____________)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailOpen && selectedNote && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Detail Pengiriman</h2>
              <button className="btn" onClick={() => setIsDetailOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pelanggan</span>
                <span style={{ fontWeight: 600 }}>{selectedNote.sales_orders?.customers?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Alamat Kirim</span>
                <span style={{ fontWeight: 500, textAlign: 'right' }}>{selectedNote.sales_orders?.customers?.address || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Supir & Truk</span>
                <span style={{ fontWeight: 500 }}>{selectedNote.drivers?.name} ({selectedNote.vehicles?.plate_number})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{selectedNote.status}</span>
              </div>
              
              {/* Item List */}
              <div style={{ padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Daftar Semen yang Dikirim:</strong>
                <ul style={{ paddingLeft: '1.25rem' }}>
                  {selectedNote.sales_orders?.sales_order_items?.map((item: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: '0.25rem' }}>
                      {item.products?.name} - <strong>{item.qty} sak</strong>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Photos Row */}
              <div style={{ marginTop: '0.5rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Foto Bukti Pengiriman:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Foto Loading */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>1. Foto Loading Semen:</span>
                    {selectedNote.loading_image ? (
                      <a href={selectedNote.loading_image} target="_blank" rel="noreferrer">
                        <img 
                          src={selectedNote.loading_image} 
                          alt="Foto Loading" 
                          style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} 
                        />
                      </a>
                    ) : (
                      <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Belum diupload
                      </div>
                    )}
                  </div>

                  {/* Foto Sampai */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>2. Foto Penerimaan Semen:</span>
                    {selectedNote.receipt_image ? (
                      <a href={selectedNote.receipt_image} target="_blank" rel="noreferrer">
                        <img 
                          src={selectedNote.receipt_image} 
                          alt="Foto Penerimaan" 
                          style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} 
                        />
                      </a>
                    ) : (
                      <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        Belum diupload
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn" onClick={() => {
                const custName = selectedNote.sales_orders?.customers?.name || 'Pelanggan';
                const address = selectedNote.sales_orders?.customers?.address || '-';
                const driver = selectedNote.drivers?.name || 'Supir';
                const plate = selectedNote.vehicles?.plate_number || '-';
                const items = selectedNote.sales_orders?.sales_order_items?.map((i: any) => `${i.products?.name} (${i.qty} sak)`).join(', ');
                const phone = selectedNote.sales_orders?.customers?.contact || '';
                const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '62');
                const message = `Halo ${custName},\n\nPT RIS INVESTINDO menginformasikan status pengiriman semen Anda:\nNo. Surat Jalan: ${selectedNote.id.split('-')[0].toUpperCase()}\n\nDetail Armada:\nSupir: ${driver}\nNo. Plat Truk: ${plate}\nProduk: ${items}\nAlamat Kirim: ${address}\n\nStatus Pengiriman: ${selectedNote.status.toUpperCase().replace('_', ' ')}.\n\nTerima kasih!`;
                window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`, '_blank');
              }} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', backgroundColor: '#128C7E', color: 'white' }}>
                💬 Kirim WA
              </button>
              <button className="btn btn-primary" onClick={() => setIsDetailOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Surat Jalan */}
      {printNote && (
        <div id="print-surat-jalan" className="print-only">
          <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>PT RIS INVESTINDO</h2>
              <h3 style={{ margin: '0.5rem 0', letterSpacing: '0.1em' }}>SURAT JALAN</h3>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>No: {printNote.id?.split('-')[0]?.toUpperCase()}</p>
            </div>
            <table style={{ width: '100%', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <tbody>
                <tr><td style={{ padding: '0.3rem 0', width: '35%' }}>Tanggal</td><td>: {new Date(printNote.created_at || printNote.sales_orders?.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
                <tr><td style={{ padding: '0.3rem 0' }}>Pelanggan</td><td>: {printNote.sales_orders?.customers?.name}</td></tr>
                <tr><td style={{ padding: '0.3rem 0' }}>Supir</td><td>: {printNote.drivers?.name}</td></tr>
                <tr><td style={{ padding: '0.3rem 0' }}>No. Polisi</td><td>: {printNote.vehicles?.plate_number}</td></tr>
              </tbody>
            </table>
            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '0.75rem 0', marginBottom: '2rem', fontSize: '0.85rem' }}>
              <p>Barang yang dikirim sesuai dengan Sales Order terkait.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', fontSize: '0.8rem' }}>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <p>Pengirim</p><br/><br/><br/>
                <p style={{ borderTop: '1px solid #000', paddingTop: '0.25rem' }}>(_____________)</p>
              </div>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <p>Supir</p><br/><br/><br/>
                <p style={{ borderTop: '1px solid #000', paddingTop: '0.25rem' }}>{printNote.drivers?.name}</p>
              </div>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <p>Penerima</p><br/><br/><br/>
                <p style={{ borderTop: '1px solid #000', paddingTop: '0.25rem' }}>(_____________)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
