import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { Package, TrendingUp, AlertTriangle, Truck, Users, ShoppingCart, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { profile } = useAuth();
  const [totalStock, setTotalStock] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    const [stockRes, custRes, vehRes, pendRes] = await Promise.all([
      supabase.from('stock_summary').select('current_stock'),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }),
      supabase.from('sales_orders').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    ]);

    const total = stockRes.data?.reduce((acc, row) => acc + Number(row.current_stock), 0) || 0;
    setTotalStock(total);
    setTotalCustomers(custRes.count || 0);
    setTotalVehicles(vehRes.count || 0);
    setPendingOrders(pendRes.count || 0);

    // Sales data
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    const startStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data: salesRaw } = await supabase
      .from('sales_order_items')
      .select('qty, price, sales_orders!inner(created_at, status)')
      .gte('sales_orders.created_at', startStr + 'T00:00:00Z');

    const todayTotal = salesRaw?.filter(r => (r.sales_orders as any).created_at.startsWith(todayStr))
      .reduce((acc, row) => acc + (row.qty * row.price), 0) || 0;
    setTodaySales(todayTotal);

    const yestTotal = salesRaw?.filter(r => (r.sales_orders as any).created_at.startsWith(yesterdayStr))
      .reduce((acc, row) => acc + (row.qty * row.price), 0) || 0;
    setYesterdaySales(yestTotal);

    const chartMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      chartMap[d.toISOString().split('T')[0]] = 0;
    }
    salesRaw?.forEach(row => {
      const dateKey = (row.sales_orders as any).created_at.split('T')[0];
      if (chartMap[dateKey] !== undefined) chartMap[dateKey] += (row.qty * row.price);
    });
    setSalesData(Object.keys(chartMap).sort().map(date => ({
      name: new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
      omzet: chartMap[date]
    })));

    // Recent sales
    const { data: recentRaw } = await supabase
      .from('sales_orders')
      .select('*, customers(name), sales_order_items(qty, price, products(name))')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentSales(recentRaw || []);

    // Low stock
    const { data: productsData } = await supabase.from('products').select('id, min_stock');
    if (productsData && stockRes.data) {
      let lowCount = 0;
      productsData.forEach(p => {
        const pStock = stockRes.data!.filter((s: any) => s.product_id === p.id).reduce((acc: number, row: any) => acc + Number(row.current_stock), 0);
        if (pStock < p.min_stock) lowCount++;
      });
      setLowStockCount(lowCount);
    }

    setLoading(false);
  };

  const salesTrend = todaySales >= yesterdaySales ? 'up' : 'down';
  const trendPercent = yesterdaySales > 0 ? Math.abs(Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100)) : 0;

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Selamat Pagi' : greetingHour < 17 ? 'Selamat Siang' : 'Selamat Malam';

  return (
    <Layout>
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {greeting}, {profile?.name?.split(' ')[0] || 'Bos'}!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Ringkasan operasional gudang semen hari ini.
          </p>
        </header>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {/* Total Stok */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
              <Package size={22} color="var(--primary-color)" />
            </div>
            <p className="stat-label">Total Stok Aktif</p>
            <p className="stat-value">{loading ? '—' : totalStock.toLocaleString('id-ID')}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>sak tersedia</p>
          </div>

          {/* Omzet Hari Ini */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(52, 211, 153, 0.15)' }}>
              <TrendingUp size={22} color="var(--success)" />
            </div>
            <p className="stat-label">Omzet Hari Ini</p>
            <p className="stat-value" style={{ fontSize: '1.5rem' }}>{loading ? '—' : `Rp ${todaySales.toLocaleString('id-ID')}`}</p>
            {!loading && yesterdaySales > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                {salesTrend === 'up' ? <ArrowUpRight size={14} color="var(--success)" /> : <ArrowDownRight size={14} color="var(--danger)" />}
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: salesTrend === 'up' ? 'var(--success)' : 'var(--danger)' }}>
                  {trendPercent}% vs kemarin
                </span>
              </div>
            )}
          </div>

          {/* Pending */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.15)' }}>
              <Clock size={22} color="var(--warning)" />
            </div>
            <p className="stat-label">Menunggu Persetujuan</p>
            <p className="stat-value">{loading ? '—' : pendingOrders}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>pesanan draft</p>
          </div>

          {/* Low Stock */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(248, 113, 113, 0.15)' }}>
              <AlertTriangle size={22} color="var(--danger)" />
            </div>
            <p className="stat-label">Peringatan Stok</p>
            <p className="stat-value" style={{ color: lowStockCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {loading ? '—' : lowStockCount}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {lowStockCount > 0 ? 'produk hampir habis!' : 'stok aman'}
            </p>
          </div>

          {/* Customers */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(96, 165, 250, 0.15)' }}>
              <Users size={22} color="var(--info)" />
            </div>
            <p className="stat-label">Total Pelanggan</p>
            <p className="stat-value">{loading ? '—' : totalCustomers}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>pelanggan terdaftar</p>
          </div>

          {/* Vehicles */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(244, 114, 182, 0.15)' }}>
              <Truck size={22} color="var(--accent-color)" />
            </div>
            <p className="stat-label">Armada Truk</p>
            <p className="stat-value">{loading ? '—' : totalVehicles}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>kendaraan aktif</p>
          </div>
        </div>

        {/* Chart + Recent Sales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Chart */}
          <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: window.innerWidth < 768 ? 'span 2' : undefined }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} color="var(--primary-color)" /> Tren Penjualan 7 Hari
            </h3>
            {loading ? (
              <div className="skeleton" style={{ height: 250, width: '100%' }} />
            ) : (
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <AreaChart data={salesData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOmzet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip
                      formatter={(value: number) => [`Rp ${value.toLocaleString('id-ID')}`, 'Omzet']}
                      contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)' }}
                      labelStyle={{ color: 'var(--text-secondary)' }}
                    />
                    <Area type="monotone" dataKey="omzet" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorOmzet)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Recent Sales */}
          <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: window.innerWidth < 768 ? 'span 2' : undefined }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingCart size={18} color="var(--primary-color)" /> Penjualan Terbaru
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 52, width: '100%' }} />
                ))
              ) : recentSales.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Belum ada penjualan.</p>
              ) : (
                recentSales.map((sale) => {
                  const total = sale.sales_order_items?.reduce((acc: number, i: any) => acc + (i.qty * i.price), 0) || 0;
                  const statusColor = sale.status === 'draft' ? 'var(--warning)' : sale.status === 'cancelled' ? 'var(--danger)' : 'var(--success)';
                  const statusLabel = sale.status === 'draft' ? 'Pending' : sale.status === 'cancelled' ? 'Ditolak' : 'Disetujui';
                  return (
                    <div key={sale.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.75rem', borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-tertiary)', border: '1px solid rgba(99,102,241,0.06)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: `${statusColor}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <ShoppingCart size={16} color={statusColor} />
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{sale.customers?.name || 'Pelanggan'}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(sale.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · <span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
                          </p>
                        </div>
                      </div>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        Rp {total.toLocaleString('id-ID')}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
