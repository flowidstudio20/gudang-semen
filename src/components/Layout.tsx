import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, MapPin, Users, LayoutDashboard, ShoppingCart, FileText, Menu, X, LogOut, ClipboardList, Settings, CreditCard, Send, Shield, Zap, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const role = profile?.role || 'supir_kasir';

  const menuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'kepala_gudang', 'supir_kasir'] },
    { path: '/products', name: 'Produk', icon: <Package size={20} />, roles: ['admin', 'kepala_gudang'] },
    { path: '/warehouses', name: 'Gudang', icon: <MapPin size={20} />, roles: ['admin', 'kepala_gudang'] },
    { path: '/stock', name: 'Stok Gudang', icon: <ClipboardList size={20} />, roles: ['admin', 'kepala_gudang'] },
    { path: '/customers', name: 'Pelanggan', icon: <Users size={20} />, roles: ['admin', 'supir_kasir'] },
    { path: '/transactions', name: 'Penjualan', icon: <ShoppingCart size={20} />, roles: ['admin', 'kepala_gudang', 'supir_kasir'] },
    { path: '/delivery-notes', name: 'Surat Jalan', icon: <Send size={20} />, roles: ['admin', 'kepala_gudang', 'supir_kasir'] },
    { path: '/operations', name: 'Operasional', icon: <Settings size={20} />, roles: ['admin', 'kepala_gudang', 'supir_kasir'] },
    { path: '/finance', name: 'Keuangan', icon: <CreditCard size={20} />, roles: ['admin'] },
    { path: '/reports', name: 'Laporan', icon: <FileText size={20} />, roles: ['admin', 'kepala_gudang'] },
    { path: '/user-management', name: 'Kelola Pengguna', icon: <UserPlus size={20} />, roles: ['admin'] },
  ];

  const allowedMenus = menuItems.filter(item => item.roles.includes(role));

  const getRoleBadge = () => {
    switch(role) {
      case 'admin': return { label: 'Admin', color: 'var(--primary-color)', bg: 'rgba(99, 102, 241, 0.1)' };
      case 'kepala_gudang': return { label: 'Kepala Gudang', color: 'var(--accent-secondary)', bg: 'rgba(16, 185, 129, 0.1)' };
      default: return { label: 'Supir / Kasir', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)' };
    }
  };

  const badge = getRoleBadge();

  return (
    <div className="layout-wrapper">
      {/* Mobile Header */}
      <div className="mobile-nav-toggle flex-between" style={{ flexDirection: 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src={logo} alt="RIS Logo" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: '4px' }} />
          <h2 style={{
            fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em',
            color: 'var(--text-primary)'
          }}>Semengu</h2>
        </div>
        <button className="btn" onClick={() => setIsSidebarOpen(true)} style={{ padding: '0.4rem', background: 'var(--bg-tertiary)' }}>
          <Menu size={22} />
        </button>
      </div>

      <div className={`mobile-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%' }}>
            <img src={logo} alt="RIS Logo" style={{ width: '110px', height: '110px', objectFit: 'contain' }} />
            <button className="btn" style={{ position: 'absolute', right: 0, top: 0, padding: '0.25rem', display: 'var(--mobile-close-display, none)' }} onClick={() => setIsSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          {/* User Profile Card */}
          {profile && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.05))',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(99, 102, 241, 0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 40, height: 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: '0.95rem'
                }}>
                  {profile.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.3 }}>{profile.name}</p>
                  <span style={{
                    display: 'inline-block', marginTop: '0.2rem',
                    fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: badge.bg, color: badge.color
                  }}>
                    {badge.label}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
              Menu Utama
            </p>
            {allowedMenus.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout Button */}
        <button
          className="btn"
          onClick={handleLogout}
          style={{
            width: '100%', marginTop: '2rem',
            display: 'flex', gap: '0.5rem', justifyContent: 'center',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid rgba(248, 113, 113, 0.15)',
            fontWeight: 600
          }}
        >
          <LogOut size={18} /> Keluar
        </button>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
