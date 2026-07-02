import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Vehicle { id: string; plate_number: string; capacity: number; status: string; }
interface Driver { id: string; name: string; license_no: string; contact: string; }
interface Expense { id: string; category: string; amount: number; description: string; date: string; vehicle_id?: string; vehicles?: { plate_number: string } }

export default function Operations() {
  const { profile } = useAuth();
  const isDriver = profile?.role === 'supir_kasir';
  
  const [activeTab, setActiveTab] = useState<'truk' | 'supir' | 'biaya' | 'laporan'>(isDriver ? 'biaya' : 'truk');
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formDataVehicle, setFormDataVehicle] = useState<Partial<Vehicle>>({ plate_number: '', capacity: 0, status: 'available' });
  const [formDataDriver, setFormDataDriver] = useState<Partial<Driver>>({ name: '', license_no: '', contact: '' });
  const [formDataExpense, setFormDataExpense] = useState<Partial<Expense>>({ category: 'bbm', amount: 0, description: '', vehicle_id: '' });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [vRes, dRes, eRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
      supabase.from('drivers').select('*').order('created_at', { ascending: false }),
      supabase.from('operational_expenses').select('*, vehicles(plate_number)').order('date', { ascending: false })
    ]);
    if (vRes.data) setVehicles(vRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (eRes.data) setExpenses(eRes.data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus kendaraan ini?')) return;
    await supabase.from('vehicles').delete().eq('id', id);
    setVehicles(vehicles.filter(v => v.id !== id));
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('vehicles').insert([formDataVehicle]);
    setIsModalOpen(false); setFormDataVehicle({ plate_number: '', capacity: 0, status: 'available' });
    fetchAll();
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('drivers').insert([formDataDriver]);
    setIsModalOpen(false); setFormDataDriver({ name: '', license_no: '', contact: '' });
    fetchAll();
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formDataExpense };
    if (!payload.vehicle_id) delete payload.vehicle_id; // prevent empty string inserting as uuid error
    await supabase.from('operational_expenses').insert([payload]);
    setIsModalOpen(false); setFormDataExpense({ category: 'bbm', amount: 0, description: '', vehicle_id: '' });
    fetchAll();
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Operasional Logistik</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Kelola data armada, supir, dan pengeluaran harian.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', gap: '0.5rem' }}>
              <Plus size={18} /> Tambah Data
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            {!isDriver && (
              <>
                <button className={`btn ${activeTab === 'truk' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('truk')} style={{ backgroundColor: activeTab !== 'truk' ? 'var(--bg-secondary)' : undefined, color: activeTab !== 'truk' ? 'var(--text-primary)' : undefined }}>Armada Truk</button>
                <button className={`btn ${activeTab === 'supir' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('supir')} style={{ backgroundColor: activeTab !== 'supir' ? 'var(--bg-secondary)' : undefined, color: activeTab !== 'supir' ? 'var(--text-primary)' : undefined }}>Data Supir</button>
              </>
            )}
            <button className={`btn ${activeTab === 'biaya' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('biaya')} style={{ backgroundColor: activeTab !== 'biaya' ? 'var(--bg-secondary)' : undefined, color: activeTab !== 'biaya' ? 'var(--text-primary)' : undefined }}>{isDriver ? 'Laporan Penggunaan Biaya' : 'Riwayat Biaya'}</button>
            {!isDriver && (
              <button className={`btn ${activeTab === 'laporan' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('laporan')} style={{ backgroundColor: activeTab !== 'laporan' ? 'var(--success)' : 'var(--success)', color: 'white' }}>Laporan 7 Hari Truk</button>
            )}
          </div>
        </header>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center' }}>Memuat data...</p>
          ) : activeTab === 'truk' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Plat Nomor</th>
                  <th style={{ padding: '1rem' }}>Kapasitas (Ton)</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada kendaraan.</td></tr>
                ) : vehicles.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{v.plate_number}</td>
                    <td style={{ padding: '1rem' }}>{v.capacity} Ton</td>
                    <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{v.status.replace('_', ' ')}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button onClick={() => handleDelete(v.id)} className="btn" style={{ padding: '0.25rem 0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'supir' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Nama Supir</th>
                  <th style={{ padding: '1rem' }}>No. SIM</th>
                  <th style={{ padding: '1rem' }}>Kontak</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{d.name}</td>
                    <td style={{ padding: '1rem' }}>{d.license_no}</td>
                    <td style={{ padding: '1rem' }}>{d.contact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'biaya' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Tanggal</th>
                  <th style={{ padding: '1rem' }}>Kendaraan (Opsional)</th>
                  <th style={{ padding: '1rem' }}>Kategori</th>
                  <th style={{ padding: '1rem' }}>Deskripsi</th>
                  <th style={{ padding: '1rem' }}>Jumlah (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{new Date(e.date).toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{e.vehicles?.plate_number || '-'}</td>
                    <td style={{ padding: '1rem', textTransform: 'capitalize' }}>{e.category}</td>
                    <td style={{ padding: '1rem' }}>{e.description}</td>
                    <td style={{ padding: '1rem', fontWeight: 700 }}>Rp {e.amount.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : activeTab === 'laporan' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Laporan Pengeluaran 7 Hari Terakhir</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Total biaya bahan bakar, tol, dll untuk setiap kendaraan (dihitung otomatis).</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {vehicles.map(v => {
                  const oneWeekAgo = new Date();
                  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                  
                  const vehicleExpenses = expenses.filter(e => 
                    e.vehicle_id === v.id && 
                    new Date(e.date) >= oneWeekAgo
                  );
                  
                  const total = vehicleExpenses.reduce((acc, curr) => acc + curr.amount, 0);
                  
                  return (
                    <div key={v.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>{v.plate_number}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>Kapasitas: {v.capacity} Ton</p>
                      
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                        Rp {total.toLocaleString('id-ID')}
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Total 7 hari terakhir ({vehicleExpenses.length} transaksi)</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Tambah {activeTab === 'truk' ? 'Armada Truk' : activeTab === 'supir' ? 'Supir Baru' : isDriver ? 'Laporan Penggunaan Minyak/Biaya' : 'Biaya Operasional'}</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>
            
            {activeTab === 'truk' && (
              <form onSubmit={handleSaveVehicle}>
                <div className="input-group">
                  <label className="input-label">Plat Nomor</label>
                  <input required type="text" className="input-field" value={formDataVehicle.plate_number} onChange={e => setFormDataVehicle({...formDataVehicle, plate_number: e.target.value.toUpperCase()})} placeholder="B 1234 CD" />
                </div>
                <div className="input-group">
                  <label className="input-label">Kapasitas (Ton)</label>
                  <input required type="number" className="input-field" value={formDataVehicle.capacity} onChange={e => setFormDataVehicle({...formDataVehicle, capacity: Number(e.target.value)})} />
                </div>
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}><button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Batal</button><button type="submit" className="btn btn-primary">Simpan Truk</button></div>
              </form>
            )}

            {activeTab === 'supir' && (
              <form onSubmit={handleSaveDriver}>
                <div className="input-group">
                  <label className="input-label">Nama Lengkap</label>
                  <input required type="text" className="input-field" value={formDataDriver.name} onChange={e => setFormDataDriver({...formDataDriver, name: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">No. SIM</label>
                  <input required type="text" className="input-field" value={formDataDriver.license_no} onChange={e => setFormDataDriver({...formDataDriver, license_no: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">No. Telepon / WA (Harus 13 Angka)</label>
                  <input type="text" className="input-field" pattern="[0-9]{13}" minLength={13} maxLength={13} title="Harus tepat 13 angka" value={formDataDriver.contact} onChange={e => setFormDataDriver({...formDataDriver, contact: e.target.value.replace(/\D/g, '')})} placeholder="Contoh: 0812345678901" />
                </div>
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}><button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Batal</button><button type="submit" className="btn btn-primary">Simpan Supir</button></div>
              </form>
            )}

            {activeTab === 'biaya' && (
              <form onSubmit={handleSaveExpense}>
                <div className="input-group">
                  <label className="input-label">Truk / Kendaraan (Opsional)</label>
                  <select className="input-field" value={formDataExpense.vehicle_id || ''} onChange={e => setFormDataExpense({...formDataExpense, vehicle_id: e.target.value})}>
                    <option value="">-- Tidak Terkait Kendaraan --</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Kategori Biaya</label>
                  <select className="input-field" value={formDataExpense.category} onChange={e => setFormDataExpense({...formDataExpense, category: e.target.value})}>
                    <option value="bbm">Bahan Bakar (BBM)</option>
                    <option value="tol">Tol / Parkir</option>
                    <option value="bongkar_muat">Upah Bongkar Muat</option>
                    <option value="lainnya">Lain-lain</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Keterangan / Rincian</label>
                  <input required type="text" className="input-field" value={formDataExpense.description} onChange={e => setFormDataExpense({...formDataExpense, description: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Total Biaya (Rp)</label>
                  <input required type="number" className="input-field" value={formDataExpense.amount} onChange={e => setFormDataExpense({...formDataExpense, amount: Number(e.target.value)})} />
                </div>
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}><button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Batal</button><button type="submit" className="btn btn-primary">Simpan Biaya</button></div>
              </form>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
