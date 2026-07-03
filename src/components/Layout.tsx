import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, MapPin, Users, LayoutDashboard, ShoppingCart, FileText, Menu, X, LogOut, ClipboardList, Settings, CreditCard, Send, UserPlus, AlertTriangle, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import logo from '../assets/logo.png';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<{name: string; stock: number; min: number}[]>([]);
  const [alertDismissed, setAlertDismissed] = useState(false);

  useEffect(() => {
    const checkLowStock = async () => {
      const [stockRes, prodRes] = await Promise.all([
        supabase.from('stock_summary').select('product_id, current_stock'),
        supabase.from('products').select('id, name, min_stock')
      ]);
      if (stockRes.data && prodRes.data) {
        const lowItems: {name: string; stock: number; min: number}[] = [];
        prodRes.data.forEach(p => {
          const totalStock = stockRes.data!.filter((s: any) => s.product_id === p.id)
            .reduce((acc: number, row: any) => acc + Number(row.current_stock), 0);
          if (totalStock < p.min_stock) {
            lowItems.push({ name: p.name, stock: totalStock, min: p.min_stock });
          }
        });
        setLowStockItems(lowItems);
      }
    };
    checkLowStock();
  }, []);

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
    { path: '/audit-logs', name: 'Audit Log', icon: <Activity size={20} />, roles: ['admin'] },
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
                  {item.path === '/stock' && lowStockItems.length > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      background: 'var(--danger)',
                      color: 'white',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.45rem',
                      borderRadius: 'var(--radius-full)',
                      minWidth: '18px',
                      textAlign: 'center',
                      lineHeight: 1.4
                    }}>
                      {lowStockItems.length}
                    </span>
                  )}
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
        {lowStockItems.length > 0 && !alertDismissed && (
          <div className="print-hide" style={{
            marginBottom: '1rem',
            padding: '0.85rem 1rem',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(245, 158, 11, 0.06))',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            animation: 'fadeIn 0.45s ease-out'
          }}>
            <AlertTriangle size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '0.25rem' }}>
                ⚠ Peringatan Stok Menipis!
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {lowStockItems.map((item, i) => (
                  <span key={i}>
                    <strong>{item.name}</strong> (sisa {item.stock}, min {item.min}){i < lowStockItems.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </p>
            </div>
            <button onClick={() => setAlertDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--text-muted)', flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
