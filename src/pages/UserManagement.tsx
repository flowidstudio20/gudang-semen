import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { UserPlus, Users, Shield, Trash2, X, Eye, Edit } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function UserManagement() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'supir_kasir'
  });

  const [editData, setEditData] = useState({
    name: '',
    role: 'supir_kasir'
  });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: formData.role,
          }
        }
      });
      if (error) throw error;

      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'supir_kasir' });
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Gagal mendaftarkan pengguna.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({ name: editData.name, role: editData.role })
        .eq('id', selectedUser.id);

      if (error) throw error;

      setIsEditOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui pengguna.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Yakin ingin menghapus pengguna ini?')) return;
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      fetchUsers();
    } catch (err: any) {
      alert('Gagal menghapus pengguna (User ini kemungkinan sudah memiliki riwayat transaksi/aktivitas di database): ' + err.message);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin', className: 'badge-info' };
      case 'kepala_gudang':
        return { label: 'Kepala Gudang', className: 'badge-success' };
      default:
        return { label: 'Supir / Kasir', className: 'badge-warning' };
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <Layout>
        <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <Shield size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Akses Ditolak</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Hanya Admin yang dapat mengelola pengguna.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Kelola Pengguna</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Daftarkan dan kelola akun pengguna sistem.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => { setIsModalOpen(true); setError(null); }} style={{ display: 'flex', gap: '0.5rem' }}>
              <UserPlus size={18} /> Daftarkan User Baru
            </button>
          </div>
        </header>

        {/* User List */}
        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ padding: '1rem' }}>Nama</th>
                  <th style={{ padding: '1rem' }}>Email</th>
                  <th style={{ padding: '1rem' }}>Role</th>
                  <th style={{ padding: '1rem' }}>Tgl Daftar</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada pengguna.</td></tr>
                ) : users.map(u => {
                  const badge = getRoleBadge(u.role);
                  return (
                    <tr key={u.id}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--primary-color), #3b82f6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0
                          }}>
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`badge ${badge.className}`}>{badge.label}</span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn" onClick={() => { setSelectedUser(u); setIsDetailOpen(true); }} style={{ padding: '0.35rem 0.5rem' }}>
                            <Eye size={14} />
                          </button>
                          <button className="btn" onClick={() => { setSelectedUser(u); setEditData({ name: u.name, role: u.role }); setIsEditOpen(true); }} style={{ padding: '0.35rem 0.5rem' }}>
                            <Edit size={14} />
                          </button>
                          <button className="btn" onClick={() => handleDelete(u.id)} style={{ padding: '0.35rem 0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Register */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Daftarkan Pengguna Baru</h2>
              <button className="btn" onClick={() => setIsModalOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>

            {error && (
              <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.8rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleRegister}>
              <div className="input-group">
                <label className="input-label">Nama Lengkap</label>
                <input required type="text" className="input-field" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Contoh: Budi Santoso" />
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input required type="email" className="input-field" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="nama@email.com" />
              </div>
              <div className="input-group">
                <label className="input-label">Password (Min 6 karakter)</label>
                <input required type="password" className="input-field" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} minLength={6} placeholder="Buat password" />
              </div>
              <div className="input-group">
                <label className="input-label">Pilih Role / Peran</label>
                <select className="input-field" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                  <option value="admin">Admin (Full Access)</option>
                  <option value="kepala_gudang">Kepala Gudang</option>
                  <option value="supir_kasir">Supir / Kasir</option>
                </select>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} disabled={saving}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Mendaftarkan...' : 'Daftarkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Edit */}
      {isEditOpen && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Edit Pengguna</h2>
              <button className="btn" onClick={() => setIsEditOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>

            {error && (
              <div style={{ padding: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.8rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleUpdate}>
              <div className="input-group">
                <label className="input-label">Nama Lengkap</label>
                <input required type="text" className="input-field" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Email (Tidak dapat diubah)</label>
                <input disabled type="email" className="input-field" value={selectedUser.email} style={{ opacity: 0.7 }} />
              </div>
              <div className="input-group">
                <label className="input-label">Pilih Role / Peran</label>
                <select className="input-field" value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })}>
                  <option value="admin">Admin (Full Access)</option>
                  <option value="kepala_gudang">Kepala Gudang</option>
                  <option value="supir_kasir">Supir / Kasir</option>
                </select>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn" onClick={() => setIsEditOpen(false)} disabled={saving}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {isDetailOpen && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Detail Pengguna</h2>
              <button className="btn" onClick={() => setIsDetailOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>ID Pengguna</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedUser.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Nama</span>
                <span style={{ fontWeight: 600 }}>{selectedUser.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Email</span>
                <span>{selectedUser.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Role / Peran</span>
                <span className={`badge ${getRoleBadge(selectedUser.role).className}`}>{getRoleBadge(selectedUser.role).label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Terdaftar Pada</span>
                <span>{new Date(selectedUser.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setIsDetailOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
