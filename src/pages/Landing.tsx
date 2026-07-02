import { Link } from 'react-router-dom';
import { Package, Truck, BarChart3, Shield, ArrowRight, Zap, CheckCircle, Warehouse } from 'lucide-react';
import logo from '../assets/logo.png';

export default function Landing() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <header style={{ padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src={logo} alt="RIS Logo" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: '6px' }} />
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Semengu</h1>
        </div>
        <Link to="/login" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          Masuk <ArrowRight size={16} />
        </Link>
      </header>

      {/* HERO */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <section className="animate-fade-in" style={{ textAlign: 'center', padding: '5rem 1.5rem 3rem', maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 1rem', borderRadius: 'var(--radius-full)',
            background: 'var(--primary-light)', color: 'var(--primary-color)',
            fontSize: '0.8rem', fontWeight: 700, marginBottom: '1.5rem',
            border: '1px solid rgba(99, 102, 241, 0.15)'
          }}>
            <Shield size={14} /> Sistem Gudang Terintegrasi
          </div>

          <h1 style={{
            fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', fontWeight: 900,
            lineHeight: 1.15, marginBottom: '1.25rem',
            letterSpacing: '-0.03em', color: 'var(--text-primary)'
          }}>
            Kelola Gudang Semen <br />
            <span style={{ color: 'var(--primary-color)' }}>Lebih Cerdas & Efisien</span>
          </h1>

          <p style={{
            fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.7,
            maxWidth: '560px', margin: '0 auto 2.5rem'
          }}>
            Pantau stok, kelola penjualan, lacak pengiriman, dan buat laporan keuangan dalam satu platform yang dirancang khusus untuk bisnis semen Anda.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/login" className="btn btn-primary" style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}>
              Mulai Sekarang
            </Link>
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '3rem', flexWrap: 'wrap' }}>
            {[
              { icon: <CheckCircle size={16} />, text: 'Multi-Role Access' },
              { icon: <CheckCircle size={16} />, text: 'Approval Workflow' },
              { icon: <CheckCircle size={16} />, text: 'Laporan Otomatis' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>
                <span style={{ color: 'var(--success)' }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section style={{ padding: '3rem 1.5rem 5rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {[
              {
                icon: <Package size={28} />,
                color: 'var(--primary-color)',
                bg: 'rgba(99, 102, 241, 0.08)',
                title: 'Manajemen Stok',
                desc: 'Lacak ketersediaan semen per gudang secara real-time dengan peringatan stok minimum otomatis.'
              },
              {
                icon: <Truck size={28} />,
                color: 'var(--success)',
                bg: 'rgba(16, 185, 129, 0.08)',
                title: 'Tracking Armada',
                desc: 'Kelola surat jalan dan pantau biaya operasional setiap kendaraan dengan laporan mingguan.'
              },
              {
                icon: <BarChart3 size={28} />,
                color: 'var(--warning)',
                bg: 'rgba(245, 158, 11, 0.08)',
                title: 'Laporan Keuangan',
                desc: 'Ringkasan penjualan, piutang, dan biaya operasional yang akurat dan mudah dipahami.'
              },
              {
                icon: <Warehouse size={28} />,
                color: 'var(--info)',
                bg: 'rgba(59, 130, 246, 0.08)',
                title: 'Multi Gudang',
                desc: 'Dukung pengelolaan beberapa gudang sekaligus dengan stok terpisah dan laporan terpusat.'
              },
            ].map((feature, i) => (
              <div key={i} className="glass-panel animate-fade-in" style={{ padding: '1.75rem', animationDelay: `${i * 0.1}s` }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 'var(--radius-md)',
                  background: feature.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '1.25rem', color: feature.color
                }}>
                  {feature.icon}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  {feature.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{
          padding: '1.5rem', textAlign: 'center',
          borderTop: '1px solid var(--border-color)',
          width: '100%', color: 'var(--text-muted)', fontSize: '0.8rem'
        }}>
          Semengu — PT Ris Investindo
        </footer>
      </main>
    </div>
  );
}
