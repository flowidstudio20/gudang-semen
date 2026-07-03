import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Eye, X, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Finance() {
  const { profile } = useAuth();
  const [receivables, setReceivables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Payment modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [payAmount, setPayAmount] = useState(0);
  const [payNote, setPayNote] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('receivables').select('*, customers(name), sales_orders(created_at)').order('created_at', { ascending: false });
    
    if (data) {
      // For each receivable, fetch total paid
      const enriched = await Promise.all(data.map(async (r) => {
        const { data: payments } = await supabase.from('payment_history').select('amount').eq('receivable_id', r.id);
        const totalPaid = payments?.reduce((acc: number, p: any) => acc + Number(p.amount), 0) || 0;
        return { ...r, total_paid: totalPaid, remaining: r.amount - totalPaid };
      }));
      setReceivables(enriched);
    }
    setLoading(false);
  };

  const openPayModal = (r: any) => {
    setSelectedReceivable(r);
    setPayAmount(r.remaining);
    setPayNote('');
    setIsPayModalOpen(true);
  };

  const openDetail = async (r: any) => {
    setSelectedReceivable(r);
    const { data } = await supabase.from('payment_history').select('*').eq('receivable_id', r.id).order('created_at', { ascending: false });
    setPaymentHistory(data || []);
    setIsDetailOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) return alert('Nominal pembayaran harus lebih dari 0');
    if (payAmount > selectedReceivable.remaining) return alert('Nominal melebihi sisa tagihan');

    const { error } = await supabase.from('payment_history').insert([{
      receivable_id: selectedReceivable.id,
      amount: payAmount,
      note: payNote,
      created_by: profile?.id
    }]);

    if (error) {
      alert('Gagal mencatat pembayaran: ' + error.message);
      return;
    }

    // Update receivable status
    const newTotalPaid = selectedReceivable.total_paid + payAmount;
    const newStatus = newTotalPaid >= selectedReceivable.amount ? 'paid' : 'partial';
    
    await supabase.from('receivables').update({ status: newStatus }).eq('id', selectedReceivable.id);
    
    setIsPayModalOpen(false);
    fetchData();
  };

  const getStatusLabel = (r: any) => {
    if (r.status === 'paid' || r.remaining <= 0) return { text: 'LUNAS', color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.1)' };
    if (r.status === 'partial' || r.total_paid > 0) return { text: 'CICILAN', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)' };
    return { text: 'BELUM BAYAR', color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.1)' };
  };

  const filteredReceivables = receivables.filter(r => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'unpaid') return r.status !== 'paid' && r.total_paid === 0;
    if (filterStatus === 'partial') return r.status === 'partial' || (r.total_paid > 0 && r.remaining > 0);
    if (filterStatus === 'paid') return r.status === 'paid' || r.remaining <= 0;
    return true;
  });

  // Summary stats
  const totalPiutang = receivables.reduce((acc, r) => acc + r.amount, 0);
  const totalDibayar = receivables.reduce((acc, r) => acc + r.total_paid, 0);
  const totalSisa = totalPiutang - totalDibayar;

  return (
    <Layout>
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Keuangan (Piutang)</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Pantau tagihan pelanggan, pembayaran cicilan, dan status piutang.</p>
        </header>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <p className="stat-label">Total Piutang</p>
            <p className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--danger)' }}>Rp {totalPiutang.toLocaleString('id-ID')}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Total Diterima</p>
            <p className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--success)' }}>Rp {totalDibayar.toLocaleString('id-ID')}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">Sisa Tagihan</p>
            <p className="stat-value" style={{ fontSize: '1.25rem', color: totalSisa > 0 ? 'var(--warning)' : 'var(--success)' }}>Rp {totalSisa.toLocaleString('id-ID')}</p>
          </div>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: '1rem' }}>
          <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: '200px' }}>
            <option value="all">Semua Status</option>
            <option value="unpaid">Belum Bayar</option>
            <option value="partial">Cicilan</option>
            <option value="paid">Lunas</option>
          </select>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <p style={{ padding: '2rem', textAlign: 'center' }}>Memuat data...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Tgl Tagihan</th>
                  <th style={{ padding: '1rem' }}>Pelanggan</th>
                  <th style={{ padding: '1rem' }}>Total Tagihan</th>
                  <th style={{ padding: '1rem' }}>Sudah Dibayar</th>
                  <th style={{ padding: '1rem' }}>Sisa</th>
                  <th style={{ padding: '1rem' }}>Status</th>
                  <th style={{ padding: '1rem' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceivables.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center' }}>Tidak ada data piutang.</td></tr>
                ) : filteredReceivables.map((r) => {
                  const status = getStatusLabel(r);
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem' }}>{new Date(r.sales_orders?.created_at).toLocaleDateString('id-ID')}</td>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{r.customers?.name}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>Rp {r.amount.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '1rem', color: 'var(--success)', fontWeight: 600 }}>Rp {r.total_paid.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '1rem', fontWeight: 700, color: r.remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        Rp {r.remaining.toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                          backgroundColor: status.bg, color: status.color
                        }}>
                          {status.text}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <button className="btn" onClick={() => openDetail(r)} style={{ padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }} title="Riwayat">
                          <Eye size={16} />
                        </button>
                        {r.remaining > 0 && (
                          <button className="btn" onClick={() => openPayModal(r)} style={{ padding: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }} title="Catat Pembayaran">
                            <CreditCard size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Catat Pembayaran */}
      {isPayModalOpen && selectedReceivable && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Catat Pembayaran</h2>
              <button className="btn" onClick={() => setIsPayModalOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>
            
            <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              <p><strong>Pelanggan:</strong> {selectedReceivable.customers?.name}</p>
              <p><strong>Total Tagihan:</strong> Rp {selectedReceivable.amount.toLocaleString('id-ID')}</p>
              <p><strong>Sudah Dibayar:</strong> Rp {selectedReceivable.total_paid.toLocaleString('id-ID')}</p>
              <p style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '1rem', marginTop: '0.5rem' }}>
                Sisa: Rp {selectedReceivable.remaining.toLocaleString('id-ID')}
              </p>
            </div>

            <form onSubmit={handlePayment}>
              <div className="input-group">
                <label className="input-label">Nominal Pembayaran (Rp)</label>
                <input required type="number" className="input-field" value={payAmount} onChange={e => setPayAmount(Number(e.target.value) || 0)} min={1} max={selectedReceivable.remaining} />
              </div>
              <div className="input-group">
                <label className="input-label">Catatan (Opsional)</label>
                <input type="text" className="input-field" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Misal: Cicilan ke-2 via transfer" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn" onClick={() => { setPayAmount(selectedReceivable.remaining); }} style={{ fontSize: '0.8rem' }}>
                  Bayar Lunas
                </button>
                <div style={{ flex: 1 }} />
                <button type="button" className="btn" onClick={() => setIsPayModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--success)' }}>Simpan Pembayaran</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Riwayat Pembayaran */}
      {isDetailOpen && selectedReceivable && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Riwayat Pembayaran</h2>
              <button className="btn" onClick={() => setIsDetailOpen(false)} style={{ padding: '0.25rem' }}><X size={20} /></button>
            </div>
            
            {/* Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pelanggan</span>
                <span style={{ fontWeight: 600 }}>{selectedReceivable.customers?.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Tagihan</span>
                <span style={{ fontWeight: 700 }}>Rp {selectedReceivable.amount.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Dibayar</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>Rp {selectedReceivable.total_paid.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Sisa Tagihan</span>
                <span style={{ fontWeight: 700, color: selectedReceivable.remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  Rp {selectedReceivable.remaining.toLocaleString('id-ID')}
                </span>
              </div>
              
              {/* Progress bar */}
              <div style={{ marginTop: '0.25rem' }}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', height: '8px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${Math.min((selectedReceivable.total_paid / selectedReceivable.amount) * 100, 100)}%`,
                    height: '100%',
                    background: selectedReceivable.remaining <= 0 ? 'var(--success)' : 'linear-gradient(90deg, var(--success), var(--warning))',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'right' }}>
                  {Math.min(Math.round((selectedReceivable.total_paid / selectedReceivable.amount) * 100), 100)}% terbayar
                </p>
              </div>
            </div>

            {/* Payment History List */}
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Riwayat Pembayaran ({paymentHistory.length})
            </h3>
            
            {paymentHistory.length === 0 ? (
              <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Belum ada pembayaran tercatat.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {paymentHistory.map((p, idx) => (
                  <div key={p.id} style={{
                    padding: '0.75rem',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '3px solid var(--success)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>Pembayaran #{paymentHistory.length - idx}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(p.payment_date || p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {p.note ? ` · ${p.note}` : ''}
                      </p>
                    </div>
                    <p style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.95rem' }}>
                      +Rp {Number(p.amount).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => setIsDetailOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
