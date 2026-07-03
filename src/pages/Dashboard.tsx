import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { 
  Package, TrendingUp, AlertTriangle, Truck, Users, ShoppingCart, 
  ArrowUpRight, ArrowDownRight, Clock, Send, MapPin, Activity, Landmark, Camera
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/audit';

export default function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role || 'supir_kasir';

  // Common loading state
  const [loading, setLoading] = useState(true);

  // Admin Dashboard States
  const [totalStock, setTotalStock] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [yesterdaySales, setYesterdaySales] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  // Kepala Gudang States
  const [lowStockItemsList, setLowStockItemsList] = useState<any[]>([]);
  const [pendingDeliveriesList, setPendingDeliveriesList] = useState<any[]>([]);

  // Supir Kasir States
  const [driverId, setDriverId] = useState<string | null>(null);
  const [myDeliveries, setMyDeliveries] = useState<any[]>([]);
  const [myExpenses, setMyExpenses] = useState<any[]>([]);
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);
  const [uploadingDelivId, setUploadingDelivId] = useState<string | null>(null);
  
  // Quick Expense Form (Supir)
  const [expenseForm, setExpenseForm] = useState({
    category: 'bbm',
    amount: 0,
    description: '',
    vehicle_id: ''
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      if (role === 'admin') {
        // FETCH ADMIN DATA
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

        // Sales data (last 7 days)
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

        // Low stock count
        const { data: productsData } = await supabase.from('products').select('id, min_stock');
        if (productsData && stockRes.data) {
          let lowCount = 0;
          productsData.forEach(p => {
            const pStock = stockRes.data!.filter((s: any) => s.product_id === p.id).reduce((acc: number, row: any) => acc + Number(row.current_stock), 0);
            if (pStock < p.min_stock) lowCount++;
          });
          setLowStockCount(lowCount);
        }
      } else if (role === 'kepala_gudang') {
        // FETCH KEPALA GUDANG DATA
        const [stockRes, prodRes, pendingDelivRes] = await Promise.all([
          supabase.from('stock_summary').select('product_id, warehouse_id, current_stock, products(name), warehouses(name)'),
          supabase.from('products').select('id, name, min_stock'),
          supabase.from('delivery_notes')
            .select('*, sales_orders(customers(name), created_at), vehicles(plate_number), drivers(name)')
            .neq('status', 'delivered')
        ]);

        // Calculate total stock
        const total = stockRes.data?.reduce((acc, row) => acc + Number(row.current_stock), 0) || 0;
        setTotalStock(total);

        // Find low stock items
        const lowItems: any[] = [];
        if (prodRes.data && stockRes.data) {
          prodRes.data.forEach(p => {
            const totalStock = stockRes.data!.filter((s: any) => s.product_id === p.id)
              .reduce((acc: number, row: any) => acc + Number(row.current_stock), 0);
            if (totalStock < p.min_stock) {
              lowItems.push({
                name: p.name,
                stock: totalStock,
                min_stock: p.min_stock
              });
            }
          });
        }
        setLowStockCount(lowItems.length);
        setLowStockItemsList(lowItems);
        
        // Sort by sales order date client-side
        const sortedDelivs = (pendingDelivRes.data || []).sort((a: any, b: any) => 
          new Date(b.sales_orders?.created_at || 0).getTime() - new Date(a.sales_orders?.created_at || 0).getTime()
        );
        setPendingDeliveriesList(sortedDelivs);
      } else if (role === 'supir_kasir') {
        // FETCH SUPIR KASIR DATA
        // 1. Match driver by user name
        const { data: driverData } = await supabase
          .from('drivers')
          .select('id, name')
          .ilike('name', profile.name || '')
          .maybeSingle();

        const vRes = await supabase.from('vehicles').select('id, plate_number');
        if (vRes.data) setVehiclesList(vRes.data);

        if (driverData) {
          setDriverId(driverData.id);

          // 2. Fetch assigned active deliveries
          const { data: delivData } = await supabase
            .from('delivery_notes')
            .select('*, sales_orders(created_at, customers(name, address), sales_order_items(qty, price, products(name))), vehicles(plate_number)')
            .eq('driver_id', driverData.id)
            .neq('status', 'delivered');

          const sortedMyDeliveries = (delivData || []).sort((a: any, b: any) => 
            new Date(b.sales_orders?.created_at || 0).getTime() - new Date(a.sales_orders?.created_at || 0).getTime()
          );
          setMyDeliveries(sortedMyDeliveries);
        }

        // 3. Fetch recent expenses created by this user
        const { data: expData } = await supabase
          .from('operational_expenses')
          .select('*, vehicles(plate_number)')
          .eq('created_by', profile.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setMyExpenses(expData || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard role data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Status updates for drivers
  const handleUpdateDeliveryStatus = async (id: string, currentStatus: string, vehicleId: string) => {
    let nextStatus = 'pending';
    if (currentStatus === 'pending') nextStatus = 'loading';
    else if (currentStatus === 'loading') nextStatus = 'on_the_way';
    else if (currentStatus === 'on_the_way') nextStatus = 'delivered';

    try {
      const payload: any = { status: nextStatus };
      if (nextStatus === 'on_the_way') payload.sent_at = new Date().toISOString();
      if (nextStatus === 'delivered') payload.received_at = new Date().toISOString();

      const { error } = await supabase.from('delivery_notes').update(payload).eq('id', id);
      if (error) throw error;

      // Update vehicle status
      if (nextStatus === 'delivered') {
        await supabase.from('vehicles').update({ status: 'available' }).eq('id', vehicleId);
      } else if (nextStatus === 'loading') {
        await supabase.from('vehicles').update({ status: 'in_use' }).eq('id', vehicleId);
      }

      await logActivity(
        profile?.id,
        profile?.name,
        'UPDATE_DELIVERY_STATUS',
        `Mengubah status Surat Jalan #${id.split('-')[0].toUpperCase()} menjadi ${nextStatus.toUpperCase()}`
      );

      fetchDashboardData();
      showToast('Status pengiriman berhasil diperbarui!');
    } catch (err: any) {
      showToast('Gagal update status: ' + err.message, 'error');
    }
  };

  const handleUploadAndChangeStatus = async (e: React.ChangeEvent<HTMLInputElement>, id: string, currentStatus: string, vehicleId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDelivId(id);

    try {
      let fileExt = file.name.includes('.') ? file.name.split('.').pop() : '';
      if (!fileExt) {
        fileExt = file.type.split('/')[1] || 'jpg';
      }
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('bukti penjualan')
        .upload(fileName, file);

      if (uploadError) throw new Error('Gagal mengunggah foto: ' + uploadError.message);

      const { data: urlData } = supabase.storage
        .from('bukti penjualan')
        .getPublicUrl(fileName);

      const imageUrl = urlData.publicUrl;

      let nextStatus = 'pending';
      const payload: any = {};

      if (currentStatus === 'pending') {
        nextStatus = 'loading';
        payload.status = nextStatus;
        payload.loading_image = imageUrl;
      } else if (currentStatus === 'on_the_way') {
        nextStatus = 'delivered';
        payload.status = nextStatus;
        payload.receipt_image = imageUrl;
        payload.received_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase.from('delivery_notes').update(payload).eq('id', id);
      if (updateError) throw updateError;

      if (nextStatus === 'delivered') {
        await supabase.from('vehicles').update({ status: 'available' }).eq('id', vehicleId);
      } else if (nextStatus === 'loading') {
        await supabase.from('vehicles').update({ status: 'in_use' }).eq('id', vehicleId);
      }

      await logActivity(
        profile?.id,
        profile?.name,
        'UPLOAD_DELIVERY_PHOTO',
        `Mengunggah foto bukti dan mengubah status Surat Jalan #${id.split('-')[0].toUpperCase()} menjadi ${nextStatus.toUpperCase()}`
      );

      fetchDashboardData();
      showToast('Foto berhasil diunggah dan status diperbarui!');
    } catch (err: any) {
      showToast('Gagal memperbarui: ' + err.message, 'error');
    } finally {
      setUploadingDelivId(null);
    }
  };

  // Log expense from supir dashboard
  const handleSaveQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseForm.amount <= 0) return alert('Jumlah biaya harus lebih dari 0');
    
    try {
      const payload: any = {
        category: expenseForm.category,
        amount: expenseForm.amount,
        description: expenseForm.description || `Laporan ${expenseForm.category}`,
        created_by: profile?.id
      };
      if (expenseForm.vehicle_id) payload.vehicle_id = expenseForm.vehicle_id;

      const { error } = await supabase.from('operational_expenses').insert([payload]);
      if (error) throw error;

      await logActivity(
        profile?.id,
        profile?.name,
        'CREATE_EXPENSE',
        `Supir/Kasir mencatat biaya operasional Kategori: ${expenseForm.category.toUpperCase()} senilai Rp ${expenseForm.amount.toLocaleString('id-ID')}`
      );

      showToast('Laporan biaya berhasil disimpan!');
      setExpenseForm({ category: 'bbm', amount: 0, description: '', vehicle_id: '' });
      fetchDashboardData();
    } catch (err: any) {
      showToast('Gagal menyimpan laporan biaya: ' + err.message, 'error');
    }
  };

  const salesTrend = todaySales >= yesterdaySales ? 'up' : 'down';
  const trendPercent = yesterdaySales > 0 ? Math.abs(Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100)) : 0;

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Selamat Pagi' : greetingHour < 17 ? 'Selamat Siang' : 'Selamat Malam';

  // Helper for delivery status badges
  const getDeliveryStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'var(--text-muted)';
      case 'loading': return 'var(--warning)';
      case 'on_the_way': return 'var(--info)';
      case 'delivered': return 'var(--success)';
      default: return 'var(--text-primary)';
    }
  };

  return (
    <Layout>
      <div className="animate-fade-in">
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {greeting}, {profile?.name?.split(' ')[0] || 'Bos'}!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {role === 'admin' && 'Ringkasan operasional dan finansial bisnis hari ini.'}
            {role === 'kepala_gudang' && 'Pantau ketersediaan stok semen dan jadwal logistik.'}
            {role === 'supir_kasir' && 'Kelola pengiriman surat jalan dan laporan biaya harian Anda.'}
          </p>
        </header>

        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Memuat Dashboard...</p>
          </div>
        ) : (
          <>
            {/* ==================== 1. ADMIN DASHBOARD ==================== */}
            {role === 'admin' && (
              <>
                {/* Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                      <Package size={22} color="var(--primary-color)" />
                    </div>
                    <p className="stat-label">Total Stok Aktif</p>
                    <p className="stat-value">{totalStock.toLocaleString('id-ID')}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>sak semen</p>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(52, 211, 153, 0.15)' }}>
                      <TrendingUp size={22} color="var(--success)" />
                    </div>
                    <p className="stat-label">Omzet Hari Ini</p>
                    <p className="stat-value" style={{ fontSize: '1.4rem' }}>Rp {todaySales.toLocaleString('id-ID')}</p>
                    {yesterdaySales > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                        {salesTrend === 'up' ? <ArrowUpRight size={14} color="var(--success)" /> : <ArrowDownRight size={14} color="var(--danger)" />}
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: salesTrend === 'up' ? 'var(--success)' : 'var(--danger)' }}>
                          {trendPercent}% vs kemarin
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.15)' }}>
                      <Clock size={22} color="var(--warning)" />
                    </div>
                    <p className="stat-label">Persetujuan Pending</p>
                    <p className="stat-value">{pendingOrders}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>pesanan draft</p>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(248, 113, 113, 0.15)' }}>
                      <AlertTriangle size={22} color="var(--danger)" />
                    </div>
                    <p className="stat-label">Peringatan Stok</p>
                    <p className="stat-value" style={{ color: lowStockCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {lowStockCount}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {lowStockCount > 0 ? 'produk kritis' : 'semua stok aman'}
                    </p>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(96, 165, 250, 0.15)' }}>
                      <Users size={22} color="var(--info)" />
                    </div>
                    <p className="stat-label">Pelanggan</p>
                    <p className="stat-value">{totalCustomers}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>toko terdaftar</p>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(244, 114, 182, 0.15)' }}>
                      <Truck size={22} color="var(--accent-color)" />
                    </div>
                    <p className="stat-label">Armada Truk</p>
                    <p className="stat-value">{totalVehicles}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>truk aktif</p>
                  </div>
                </div>

                {/* Chart + Recent Sales */}
                <div className="dashboard-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <TrendingUp size={18} color="var(--primary-color)" /> Tren Penjualan 7 Hari
                    </h3>
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
                            formatter={(value: any) => [`Rp ${Number(value || 0).toLocaleString('id-ID')}`, 'Omzet']}
                            contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)' }}
                            labelStyle={{ color: 'var(--text-secondary)' }}
                          />
                          <Area type="monotone" dataKey="omzet" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorOmzet)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShoppingCart size={18} color="var(--primary-color)" /> Penjualan Terbaru
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {recentSales.length === 0 ? (
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
              </>
            )}

            {/* ==================== 2. KEPALA GUDANG DASHBOARD ==================== */}
            {role === 'kepala_gudang' && (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div className="stat-card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                      <Package size={22} color="var(--primary-color)" />
                    </div>
                    <p className="stat-label">Total Stok Semen</p>
                    <p className="stat-value">{totalStock.toLocaleString('id-ID')}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>sak semen tersedia</p>
                  </div>

                  <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
                      <AlertTriangle size={22} color="var(--danger)" />
                    </div>
                    <p className="stat-label">Stok Kritis</p>
                    <p className="stat-value" style={{ color: lowStockCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{lowStockCount}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>item di bawah stok min.</p>
                  </div>

                  <div className="stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
                      <Send size={22} color="var(--info)" />
                    </div>
                    <p className="stat-label">Pengiriman Aktif</p>
                    <p className="stat-value">{pendingDeliveriesList.length}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>surat jalan belum selesai</p>
                  </div>
                </div>

                {/* Main panels */}
                <div className="dashboard-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* Low Stock Panel */}
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={18} /> Daftar Stok Hampir Habis
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {lowStockItemsList.length === 0 ? (
                        <p style={{ color: 'var(--success)', textAlign: 'center', padding: '2rem 0', fontWeight: 600 }}>Stok seluruh semen aman.</p>
                      ) : (
                        lowStockItemsList.map((item, idx) => (
                          <div key={idx} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)',
                            borderRadius: 'var(--radius-md)'
                          }}>
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{item.name}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stok Minimal: {item.min_stock} sak</p>
                            </div>
                            <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--danger)' }}>{item.stock} sak</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Active Shipments Panel */}
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Send size={18} /> Pengiriman Semen Aktif (Surat Jalan)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {pendingDeliveriesList.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Tidak ada pengiriman semen hari ini.</p>
                      ) : (
                        pendingDeliveriesList.slice(0, 5).map((note) => (
                          <div key={note.id} style={{
                            padding: '0.85rem 1rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div>
                              <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{note.sales_orders?.customers?.name || 'Toko'}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Supir: {note.drivers?.name} · Plat: {note.vehicles?.plate_number}</p>
                            </div>
                            <span style={{
                              padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                              textTransform: 'uppercase', color: getDeliveryStatusColor(note.status),
                              background: 'var(--bg-primary)', border: `1px solid ${getDeliveryStatusColor(note.status)}`
                            }}>
                              {note.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ==================== 3. SUPIR / KASIR DASHBOARD ==================== */}
            {role === 'supir_kasir' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* 3.1 Greet & Status Info */}
                {!driverId ? (
                  <div style={{
                    padding: '1.25rem', background: 'rgba(245, 158, 11, 0.08)', 
                    border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-lg)',
                    color: 'var(--text-primary)', lineHeight: 1.5
                  }}>
                    <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>📢 Peringatan Akun</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Akun Anda (<strong>{profile?.name}</strong>) belum ditautkan ke profil Supir di database. 
                      Minta admin menyamakan nama supir di menu <strong>{"Operasional -> Data Supir"}</strong> agar Anda dapat melihat tugas pengiriman di dashboard ini.
                    </p>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', alignItems: 'flex-start' }}>
                  
                  {/* Left Column: Delivery Tasks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)' }}>
                        <Truck size={20} /> Jadwal Kirim Hari Ini ({myDeliveries.length})
                      </h2>
                      
                      {myDeliveries.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>
                          Tidak ada pengiriman semen aktif yang ditugaskan kepada Anda hari ini.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {myDeliveries.map((deliv) => (
                            <div key={deliv.id} style={{
                              padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                              borderLeft: '4px solid var(--primary-color)'
                            }}>
                              <div className="flex-between" style={{ marginBottom: '0.75rem', flexDirection: 'row' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                  ID: {deliv.id.split('-')[0].toUpperCase()}
                                </span>
                                <span style={{
                                  fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                                  color: getDeliveryStatusColor(deliv.status)
                                }}>
                                  ● STATUS: {deliv.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                {deliv.sales_orders?.customers?.name}
                              </p>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <MapPin size={14} /> {deliv.sales_orders?.customers?.address || '-'}
                              </p>
                              
                              {/* Items list */}
                              <div style={{ margin: '0.5rem 0', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '4px', fontSize: '0.75rem' }}>
                                <strong>Daftar Semen:</strong>
                                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                                  {deliv.sales_orders?.sales_order_items?.map((item: any, idx: number) => (
                                    <li key={idx}>{item.products?.name} - <strong>{item.qty} sak</strong></li>
                                  ))}
                                </ul>
                              </div>

                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                Truk: <strong>{deliv.vehicles?.plate_number}</strong>
                              </p>

                              {uploadingDelivId === deliv.id ? (
                                <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                  Mengunggah foto, mohon tunggu...
                                </div>
                              ) : (
                                <>
                                  {deliv.status === 'pending' && (
                                    <label className="btn btn-primary" style={{ width: '100%', background: 'var(--warning)', cursor: 'pointer', display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                      <Camera size={18} /> Konfirmasi Mulai Loading (Upload Foto)
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={(e) => handleUploadAndChangeStatus(e, deliv.id, deliv.status, deliv.vehicle_id)} 
                                        style={{ display: 'none' }} 
                                      />
                                    </label>
                                  )}
                                  {deliv.status === 'loading' && (
                                    <button 
                                      className="btn btn-primary"
                                      onClick={() => handleUpdateDeliveryStatus(deliv.id, deliv.status, deliv.vehicle_id)}
                                      style={{ width: '100%', background: 'var(--info)' }}
                                    >
                                      Konfirmasi Jalan (Kirim Semen)
                                    </button>
                                  )}
                                  {deliv.status === 'on_the_way' && (
                                    <label className="btn btn-primary" style={{ width: '100%', background: 'var(--success)', cursor: 'pointer', display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                      <Camera size={18} /> Konfirmasi Semen Diterima (Upload Foto)
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={(e) => handleUploadAndChangeStatus(e, deliv.id, deliv.status, deliv.vehicle_id)} 
                                        style={{ display: 'none' }} 
                                      />
                                    </label>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Quick Expense & Last Expenses */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Log Expense Form */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                        <Landmark size={20} /> Lapor Pengeluaran Truk (BBM/Tol)
                      </h2>
                      <form onSubmit={handleSaveQuickExpense}>
                        <div className="input-group">
                          <label className="input-label">Pilih Truk Terkait</label>
                          <select className="input-field" required value={expenseForm.vehicle_id} onChange={e => setExpenseForm({...expenseForm, vehicle_id: e.target.value})}>
                            <option value="">-- Pilih Truk --</option>
                            {vehiclesList.map(v => <option key={v.id} value={v.id}>{v.plate_number}</option>)}
                          </select>
                        </div>
                        <div className="input-group">
                          <label className="input-label">Kategori</label>
                          <select className="input-field" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
                            <option value="bbm">Bahan Bakar (BBM)</option>
                            <option value="tol">Tol & Parkir</option>
                            <option value="bongkar_muat">Upah Bongkar Muat</option>
                            <option value="lainnya">Lain-lain</option>
                          </select>
                        </div>
                        <div className="input-group">
                          <label className="input-label">Jumlah Uang (Rp)</label>
                          <input required type="number" className="input-field" value={expenseForm.amount || ''} onChange={e => setExpenseForm({...expenseForm, amount: Number(e.target.value)})} placeholder="Contoh: 150000" />
                        </div>
                        <div className="input-group">
                          <label className="input-label">Keterangan Tambahan</label>
                          <input type="text" className="input-field" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} placeholder="Isi detail (contoh: BBM 20 Liter)" />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, var(--danger), #f87171)' }}>
                          Kirim Laporan Pengeluaran
                        </button>
                      </form>
                    </div>

                    {/* Recent Expenses List */}
                    <div className="glass-panel" style={{ padding: '1.5rem' }}>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={18} /> Riwayat Laporan Terakhir Anda
                      </h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {myExpenses.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>Belum ada laporan pengeluaran dari Anda.</p>
                        ) : (
                          myExpenses.map((exp) => (
                            <div key={exp.id} style={{
                              padding: '0.75rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div>
                                <p style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                                  {exp.category?.toUpperCase()} ({exp.vehicles?.plate_number || 'Umum'})
                                </p>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {exp.description} · {new Date(exp.created_at || exp.date).toLocaleDateString('id-ID')}
                                </p>
                              </div>
                              <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.85rem' }}>
                                -Rp {exp.amount.toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </>
        )}
      </div>
      
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10000,
          fontWeight: 600,
          fontSize: '0.9rem',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {toast.message}
        </div>
      )}
    </Layout>
  );
}
