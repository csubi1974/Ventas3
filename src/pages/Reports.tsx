import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  LineChart, 
  Download, 
  Calendar,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ReportData {
  salesByPeriod: {
    period: string;
    total: number;
    count: number;
  }[];
  topProducts: {
    product_name: string;
    total_quantity: number;
    total_amount: number;
  }[];
  topCustomers: {
    customer_name: string;
    total_orders: number;
    total_amount: number;
  }[];
  deliveryMetrics: {
    total_deliveries: number;
    completed_deliveries: number;
    pending_deliveries: number;
    completion_rate: number;
  };
}

export function Reports() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [reportType, setReportType] = useState<'sales' | 'products' | 'customers' | 'delivery'>('sales');
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData>({
    salesByPeriod: [],
    topProducts: [],
    topCustomers: [],
    deliveryMetrics: {
      total_deliveries: 0,
      completed_deliveries: 0,
      pending_deliveries: 0,
      completion_rate: 0
    }
  });

  useEffect(() => {
    loadReportData();
  }, [dateRange, groupBy]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      // Cargar ventas por período
      const { data: salesData, error: salesError } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end)
        .order('created_at');

      if (salesError) throw salesError;

      // Cargar productos más vendidos
      const { data: productsData, error: productsError } = await supabase
        .from('order_items')
        .select(`
          quantity,
          unit_price,
          total_price,
          product:products(name)
        `)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      if (productsError) throw productsError;

      // Cargar clientes principales
      const { data: customersData, error: customersError } = await supabase
        .from('orders')
        .select(`
          total_amount,
          customer:customers(full_name)
        `)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      if (customersError) throw customersError;

      // Cargar métricas de entrega
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('delivery_routes')
        .select('status')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      if (deliveryError) throw deliveryError;

      // Procesar datos de ventas por período
      const salesByPeriod = processSalesByPeriod(salesData || [], groupBy);

      // Procesar datos de productos
      const topProducts = processTopProducts(productsData || []);

      // Procesar datos de clientes
      const topCustomers = processTopCustomers(customersData || []);

      // Procesar métricas de entrega
      const deliveryMetrics = processDeliveryMetrics(deliveryData || []);

      setReportData({
        salesByPeriod,
        topProducts,
        topCustomers,
        deliveryMetrics
      });
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processSalesByPeriod = (sales: any[], grouping: 'day' | 'week' | 'month') => {
    const groupedSales = sales.reduce((acc: any, sale: any) => {
      let period;
      const date = new Date(sale.created_at);

      switch (grouping) {
        case 'day':
          period = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          period = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      if (!acc[period]) {
        acc[period] = { total: 0, count: 0 };
      }
      acc[period].total += sale.total_amount;
      acc[period].count += 1;
      return acc;
    }, {});

    return Object.entries(groupedSales).map(([period, data]: [string, any]) => ({
      period,
      total: data.total,
      count: data.count
    })).sort((a, b) => a.period.localeCompare(b.period));
  };

  const processTopProducts = (products: any[]) => {
    const productMap = products.reduce((acc: any, item: any) => {
      const productName = item.product?.name || 'Desconocido';
      if (!acc[productName]) {
        acc[productName] = { total_quantity: 0, total_amount: 0 };
      }
      acc[productName].total_quantity += item.quantity;
      acc[productName].total_amount += item.total_price;
      return acc;
    }, {});

    return Object.entries(productMap)
      .map(([product_name, data]: [string, any]) => ({
        product_name,
        ...data
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10);
  };

  const processTopCustomers = (customers: any[]) => {
    const customerMap = customers.reduce((acc: any, order: any) => {
      const customerName = order.customer?.full_name || 'Desconocido';
      if (!acc[customerName]) {
        acc[customerName] = { total_orders: 0, total_amount: 0 };
      }
      acc[customerName].total_orders += 1;
      acc[customerName].total_amount += order.total_amount;
      return acc;
    }, {});

    return Object.entries(customerMap)
      .map(([customer_name, data]: [string, any]) => ({
        customer_name,
        ...data
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10);
  };

  const processDeliveryMetrics = (deliveries: any[]) => {
    const total_deliveries = deliveries.length;
    const completed_deliveries = deliveries.filter(d => d.status === 'completado').length;
    const pending_deliveries = deliveries.filter(d => d.status === 'pendiente').length;
    const completion_rate = total_deliveries > 0 ? (completed_deliveries / total_deliveries) * 100 : 0;

    return {
      total_deliveries,
      completed_deliveries,
      pending_deliveries,
      completion_rate
    };
  };

  const downloadReport = () => {
    let csvContent = '';
    let filename = '';

    switch (reportType) {
      case 'sales':
        csvContent = [
          ['Período', 'Total Ventas', 'Cantidad de Ventas'],
          ...reportData.salesByPeriod.map(sale => [
            sale.period,
            sale.total,
            sale.count
          ])
        ].map(row => row.join(',')).join('\n');
        filename = 'reporte-ventas';
        break;

      case 'products':
        csvContent = [
          ['Producto', 'Cantidad Total', 'Monto Total'],
          ...reportData.topProducts.map(product => [
            product.product_name,
            product.total_quantity,
            product.total_amount
          ])
        ].map(row => row.join(',')).join('\n');
        filename = 'reporte-productos';
        break;

      case 'customers':
        csvContent = [
          ['Cliente', 'Total Pedidos', 'Monto Total'],
          ...reportData.topCustomers.map(customer => [
            customer.customer_name,
            customer.total_orders,
            customer.total_amount
          ])
        ].map(row => row.join(',')).join('\n');
        filename = 'reporte-clientes';
        break;

      case 'delivery':
        csvContent = [
          ['Métrica', 'Valor'],
          ['Total Entregas', reportData.deliveryMetrics.total_deliveries],
          ['Entregas Completadas', reportData.deliveryMetrics.completed_deliveries],
          ['Entregas Pendientes', reportData.deliveryMetrics.pending_deliveries],
          ['Tasa de Completitud', `${reportData.deliveryMetrics.completion_rate.toFixed(2)}%`]
        ].map(row => row.join(',')).join('\n');
        filename = 'reporte-entregas';
        break;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}-${dateRange.start}-${dateRange.end}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Reportes</h1>
        <button
          onClick={downloadReport}
          className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 dark:hover:bg-blue-500"
        >
          <Download className="h-5 w-5" />
          Descargar Reporte
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Desde</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:bg-gray-700 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hasta</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:bg-gray-700 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Agrupar por</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Reporte</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'sales' | 'products' | 'customers' | 'delivery')}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="sales">Ventas</option>
              <option value="products">Productos</option>
              <option value="customers">Clientes</option>
              <option value="delivery">Entregas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contenido del Reporte */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {reportType === 'sales' && (
            <>
              {/* Gráfico de Ventas */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Ventas por Período</h2>
                <div className="h-64">
                  {/* Aquí iría el gráfico de ventas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Resumen de Ventas</h3>
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Período</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ventas</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {reportData.salesByPeriod.map((sale, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{sale.period}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${sale.total.toLocaleString('es-CL')}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{sale.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tendencia</h3>
                      {/* Aquí iría un gráfico de línea o barras */}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {reportType === 'products' && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Top 10 Productos</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cantidad Vendida</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Ventas</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.topProducts.map((product, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{product.product_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{product.total_quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${product.total_amount.toLocaleString('es-CL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportType === 'customers' && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Top 10 Clientes</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Pedidos</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Compras</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.topCustomers.map((customer, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{customer.customer_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{customer.total_orders}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${customer.total_amount.toLocaleString('es-CL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportType === 'delivery' && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Métricas de Entrega</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Entregas</h3>
                  <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    {reportData.deliveryMetrics.total_deliveries}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Completadas</h3>
                  <p className="mt-2 text-3xl font-semibold text-green-600 dark:text-green-400">
                    {reportData.deliveryMetrics.completed_deliveries}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Pendientes</h3>
                  <p className="mt-2 text-3xl font-semibold text-yellow-600 dark:text-yellow-400">
                    {reportData.deliveryMetrics.pending_deliveries}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Tasa de Completitud</h3>
                  <p className="mt-2 text-3xl font-semibold text-blue-600 dark:text-blue-400">
                    {reportData.deliveryMetrics.completion_rate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}