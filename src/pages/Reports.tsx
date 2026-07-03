import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../services/supabaseClient';
import { ArrowUpRight, ArrowDownRight, Printer, Download, Truck, Users } from 'lucide-react';

export default function Reports() {
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7_days' | '30_days' | 'this_month' | 'all_time'>('all_time');
  const [activeTab, setActiveTab] = useState<'pnl' | 'performance'>('pnl');

  // P&L Calculations
  const [totalOmzet, setTotalOmzet] = useState(0);
  const [totalHpp, setTotalHpp] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // Performance calculations
  const [driverPerformance, setDriverPerformance] = useState<any[]>([]);
  const [vehiclePerformance, setVehiclePerformance] = useState<any[]>([]);

  useEffect(() => {
    fetchReports();
  }, [period]);

  const fetchReports = async () => {
    setLoading(true);

    try {
      // Calculate date filters
      let startDateStr = '';
      const today = new Date();

      if (period === '7_days') {
        const d = new Date();
        d.setDate(today.getDate() - 6);
        startDateStr = d.toISOString().split('T')[0] + 'T00:00:00Z';
      } else if (period === '30_days') {
        const d = new Date();
        d.setDate(today.getDate() - 29);
        startDateStr = d.toISOString().split('T')[0] + 'T00:00:00Z';
      } else if (period === 'this_month') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startDateStr = firstDay.toISOString().split('T')[0] + 'T00:00:00Z';
      }

      // Fetch Confirmed/Delivered Sales
      let salesQuery = supabase
        .from('sales_order_items')
        .select('qty, price, products(name, buy_price), sales_orders(created_at, status, customers(name))')
        .in('sales_orders.status', ['confirmed', 'delivered']);

      if (startDateStr) {
        salesQuery = salesQuery.gte('sales_orders.created_at', startDateStr);
      }

      // Fetch Operational Expenses
      let expQuery = supabase
        .from('operational_expenses')
        .select('amount, date, vehicle_id');

      if (startDateStr) {
        expQuery = expQuery.gte('date', startDateStr.split('T')[0]);
      }

      const [salesRes, expRes, driversRes, delivRes, expDetailsRes] = await Promise.all([
        salesQuery,
        expQuery,
        supabase.from('drivers').select('id, name'),
        supabase.from('delivery_notes').select('*, sales_orders(sales_order_items(qty)), drivers(name), vehicles(plate_number)'),
        supabase.from('operational_expenses').select('*, vehicles(plate_number)')
      ]);

      if (salesRes.error) throw salesRes.error;
      if (expRes.error) throw expRes.error;

      const salesList = salesRes.data || [];
      const expensesList = expRes.data || [];

      // Calculate aggregates
      let omzetSum = 0;
      let hppSum = 0;
      salesList.forEach((item: any) => {
        omzetSum += item.qty * item.price;
        const buyPrice = item.products?.buy_price || 0;
        hppSum += item.qty * buyPrice;
      });

      const expSum = expensesList.reduce((acc, row) => acc + Number(row.amount), 0);

      setSalesData(salesList);
      setTotalOmzet(omzetSum);
      setTotalHpp(hppSum);
      setTotalExpenses(expSum);

      // Aggregate Driver Stats
      if (driversRes.data && delivRes.data) {
        const driverStats = driversRes.data.map((drv: any) => {
          const myDelivs = delivRes.data.filter((d: any) => d.driver_id === drv.id && d.status === 'delivered');
          const totalTrips = myDelivs.length;
          const totalSack = myDelivs.reduce((sum: number, d: any) => {
            const qty = d.sales_orders?.sales_order_items?.[0]?.qty || 0;
            return sum + qty;
          }, 0);
          
          const vehicleIds = Array.from(new Set(myDelivs.map((d: any) => d.vehicle_id)));
          const myExpenses = expDetailsRes.data?.filter((e: any) => vehicleIds.includes(e.vehicle_id)) || [];
          const totalCost = myExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

          return {
            name: drv.name,
            trips: totalTrips,
            sacks: totalSack,
            expenses: totalCost
          };
        });
        setDriverPerformance(driverStats);

        // Aggregate Vehicle Stats
        const uniqueVehicles = Array.from(new Set(delivRes.data.map((d: any) => d.vehicles?.plate_number).filter(Boolean)));
        const vehicleStats = uniqueVehicles.map((plate: any) => {
          const myDelivs = delivRes.data.filter((d: any) => d.vehicles?.plate_number === plate && d.status === 'delivered');
          const totalTrips = myDelivs.length;
          const totalSack = myDelivs.reduce((sum: number, d: any) => {
            const qty = d.sales_orders?.sales_order_items?.[0]?.qty || 0;
            return sum + qty;
          }, 0);

          const myExpenses = expDetailsRes.data?.filter((e: any) => e.vehicles?.plate_number === plate) || [];
          const totalCost = myExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

          return {
            plate,
            trips: totalTrips,
            sacks: totalSack,
            expenses: totalCost
          };
        });
        setVehiclePerformance(vehicleStats);
      }

    } catch (err) {
      console.error('Error generating reports:', err);
      alert('Gagal menyusun laporan keuangan.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    // 1. P&L Summary
    let csv = "LAPORAN LABA RUGI PT RIS INVESTINDO\n";
    csv += `Periode,${period}\n\n`;
    csv += "Kategori,Jumlah (IDR)\n";
    csv += `Pendapatan Kotor (Omzet),${totalOmzet}\n`;
    csv += `Harga Pokok Penjualan (HPP),-${totalHpp}\n`;
    csv += `Beban Operasional,-${totalExpenses}\n`;
    csv += `Keuntungan Bersih (Net Profit),${totalOmzet - totalHpp - totalExpenses}\n\n`;

    // 2. Sales Breakdown
    csv += "RINCIAN TRANSAKSI PENJUALAN\n";
    csv += "Tanggal,Pelanggan,Produk,Jumlah (Sak),Harga Jual,Harga Beli,Margin Keuntungan,Subtotal Jual\n";
    salesData.forEach((item) => {
      const buyPrice = item.products?.buy_price || 0;
      const margin = (item.price - buyPrice) * item.qty;
      const subtotal = item.qty * item.price;
      csv += `"${new Date(item.sales_orders?.created_at).toLocaleDateString('id-ID')}","${item.sales_orders?.customers?.name || '-'}","${item.products?.name}","${item.qty}","${item.price}","${buyPrice}","${margin}","${subtotal}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_keuangan_${period}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const netProfit = totalOmzet - totalHpp - totalExpenses;

  return (
    <Layout>
      <div className="animate-fade-in">
        <header className="flex-between print-hide" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700 }}>Laporan & Analitik Bisnis</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Evaluasi omzet keuangan, pengeluaran logistik, serta kinerja supir & armada.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select 
              className="input-field" 
              value={period} 
              onChange={e => setPeriod(e.target.value as any)}
              style={{ width: '180px', height: '40px' }}
            >
              <option value="all_time">Semua Waktu</option>
              <option value="this_month">Bulan Ini</option>
              <option value="30_days">30 Hari Terakhir</option>
              <option value="7_days">7 Hari Terakhir</option>
            </select>
            <button className="btn" onClick={handleExportCSV} style={{ display: 'flex', gap: '0.5rem', height: '40px', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
              <Download size={16} /> Ekspor Excel
            </button>
            <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', gap: '0.5rem', height: '40px', alignItems: 'center' }}>
              <Printer size={16} /> Cetak
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="print-hide" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => setActiveTab('pnl')}
            style={{
              padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 600, color: activeTab === 'pnl' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'pnl' ? '2px solid var(--primary-color)' : '2px solid transparent'
            }}
          >
            Laba Rugi & Penjualan
          </button>
          <button 
            onClick={() => setActiveTab('performance')}
            style={{
              padding: '0.75rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 600, color: activeTab === 'performance' ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'performance' ? '2px solid var(--primary-color)' : '2px solid transparent'
            }}
          >
            Kinerja Supir & Armada
          </button>
        </div>

        {/* Printable Header */}
        <div className="print-only" style={{ textAlign: 'center', marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>PT RIS INVESTINDO</h2>
          <h3 style={{ margin: '0.5rem 0' }}>LAPORAN ANAlITIK PERUSAHAAN</h3>
          <p style={{ fontSize: '0.9rem', margin: 0 }}>
            Periode: {
              period === 'all_time' ? 'Semua Waktu' :
              period === 'this_month' ? 'Bulan Ini' :
              period === '30_days' ? '30 Hari Terakhir' : '7 Hari Terakhir'
            }
          </p>
        </div>

        {activeTab === 'pnl' ? (
          <>
            {/* P&L Statement Panel */}
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Laporan Laba Rugi Bersih
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 500 }}>Pendapatan Kotor (Omzet Penjualan)</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>+ Rp {totalOmzet.toLocaleString('id-ID')}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 500 }}>Harga Pokok Penjualan (HPP / Modal Barang)</span>
                  <span style={{ fontWeight: 700, color: 'var(--danger)' }}>- Rp {totalHpp.toLocaleString('id-ID')}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontWeight: 500 }}>Beban Operasional Truk & Logistik</span>
                  <span style={{ fontWeight: 700, color: 'var(--danger)' }}>- Rp {totalExpenses.toLocaleString('id-ID')}</span>
                </div>

                <div style={{ 
                  display: 'flex', justifyContent: 'space-between', marginTop: '1rem',
                  padding: '1rem', borderRadius: 'var(--radius-md)',
                  backgroundColor: netProfit >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${netProfit >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      KEUNTUNGAN BERSIH (NET PROFIT)
                    </span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Dihitung setelah dikurangi HPP & Biaya Operasional</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.5rem', color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {netProfit >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                      Rp {netProfit.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Table Breakdown */}
            <div className="glass-panel animate-fade-in" style={{ padding: '1.25rem', overflowX: 'auto' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.75rem' }}>Rincian Penjualan Terkonfirmasi</h2>
              {loading ? (
                <p style={{ padding: '2rem', textAlign: 'center' }}>Memuat rincian laporan...</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '1rem' }}>Tanggal</th>
                      <th style={{ padding: '1rem' }}>Pelanggan</th>
                      <th style={{ padding: '1rem' }}>Produk</th>
                      <th style={{ padding: '1rem' }}>Jumlah</th>
                      <th style={{ padding: '1rem' }}>Harga Jual</th>
                      <th style={{ padding: '1rem' }}>Harga Beli</th>
                      <th style={{ padding: '1rem' }}>Margin Keuntungan</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Subtotal Jual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center' }}>Belum ada data penjualan pada periode ini.</td></tr>
                    ) : salesData.map((item, idx) => {
                      const buyPrice = item.products?.buy_price || 0;
                      const margin = item.price - buyPrice;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '1rem' }}>{new Date(item.sales_orders?.created_at).toLocaleDateString('id-ID')}</td>
                          <td style={{ padding: '1rem', fontWeight: 500 }}>{item.sales_orders?.customers?.name}</td>
                          <td style={{ padding: '1rem' }}>{item.products?.name}</td>
                          <td style={{ padding: '1rem', fontWeight: 600 }}>{item.qty} Sak</td>
                          <td style={{ padding: '1rem' }}>Rp {item.price.toLocaleString('id-ID')}</td>
                          <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>Rp {buyPrice.toLocaleString('id-ID')}</td>
                          <td style={{ padding: '1rem', color: 'var(--success)', fontWeight: 600 }}>
                            +Rp {(margin * item.qty).toLocaleString('id-ID')}
                          </td>
                          <td style={{ padding: '1rem', fontWeight: 700, textAlign: 'right' }}>
                            Rp {(item.qty * item.price).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Left Column: Driver Stats */}
            <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)' }}>
                <Users size={22} /> Kinerja Supir (Trip & Semen)
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Nama Supir</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Total Trip</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Semen Diantar</th>
                  </tr>
                </thead>
                <tbody>
                  {driverPerformance.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data supir.</td></tr>
                  ) : driverPerformance.map((drv, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{drv.name}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>{drv.trips}x kirim</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--primary-color)', fontWeight: 700 }}>{drv.sacks} sak</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right Column: Truck Expenses */}
            <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-secondary)' }}>
                <Truck size={22} /> Efisiensi Armada (Truk & Biaya)
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Nomor Polisi</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Total Trip</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Total Pengeluaran</th>
                  </tr>
                </thead>
                <tbody>
                  {vehiclePerformance.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Belum ada data armada.</td></tr>
                  ) : vehiclePerformance.map((veh, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{veh.plate}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>{veh.trips}x jalan</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>
                        Rp {veh.expenses.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
