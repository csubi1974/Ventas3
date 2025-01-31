import React, { useState, useEffect } from 'react';
import {
  Users,
  ShoppingCart,
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface DashboardStats {
  dailySales: number;
  monthlyIncome: number;
  activeCustomers: number;
  pendingDeliveries: number;
  inventory: {
    product_name: string;
    product_type: string;
    quantity: number;
    status: string;
  }[];
  alerts: {
    lowStock: { product: string; quantity: number }[];
    pendingPayments: number;
  };
  recentSales: {
    id: string;
    date: string;
    customer: string;
    total: number;
  }[];
  topProducts: {
    name: string;
    quantity: number;
  }[];
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    dailySales: 0,
    monthlyIncome: 0,
    activeCustomers: 0,
    pendingDeliveries: 0,
    inventory: [],
    alerts: {
      lowStock: [],
      pendingPayments: 0,
    },
    recentSales: [],
    topProducts: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Cargar estadísticas de ventas diarias y mensuales
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const { data: dailySales } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', today);

      const { data: monthlySales } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', firstDayOfMonth);

      // Cargar clientes activos
      const { count: activeCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact' });

      // Cargar entregas pendientes
      const { count: pendingDeliveries } = await supabase
        .from('delivery_routes')
        .select('*', { count: 'exact' })
        .eq('status', 'pendiente')
        .eq('date', today);

      // Cargar inventario completo
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select(`
          quantity,
          status,
          product:products(
            name,
            type,
            code
          )
        `)
        .order('quantity', { ascending: true });

      // Procesar datos de inventario
      const inventory = inventoryData?.map(item => ({
        product_name: item.product?.name || 'Desconocido',
        product_type: item.product?.type || 'other',
        quantity: item.quantity,
        status: item.status
      })) || [];

      // Identificar productos con stock bajo
      const lowStock = inventory
        .filter(item => item.quantity < 20)
        .map(item => ({
          product: item.product_name,
          quantity: item.quantity
        }));

      // Cargar ventas recientes
      const { data: recentSales } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_amount,
          customer:customers(
            full_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Cargar productos más vendidos
      const { data: topProducts } = await supabase
        .from('order_items')
        .select(`
          quantity,
          product:products(
            name
          )
        `)
        .gte('created_at', firstDayOfMonth)
        .order('quantity', { ascending: false })
        .limit(5);

      // Calcular totales
      const dailyTotal = dailySales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const monthlyTotal = monthlySales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;

      setStats({
        dailySales: dailyTotal,
        monthlyIncome: monthlyTotal,
        activeCustomers: activeCustomers || 0,
        pendingDeliveries: pendingDeliveries || 0,
        inventory,
        alerts: {
          lowStock,
          pendingPayments: 0,
        },
        recentSales: recentSales?.map(sale => ({
          id: sale.id,
          date: new Date(sale.created_at).toLocaleDateString(),
          customer: sale.customer?.full_name || '',
          total: sale.total_amount,
        })) || [],
        topProducts: topProducts?.map(item => ({
          name: item.product?.name || '',
          quantity: item.quantity,
        })) || [],
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-sm text-gray-500">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <AlertTriangle className="h-8 w-8 mx-auto" />
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del día</CardTitle>
            <ShoppingCart className="h-4 w-4 text-surface-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.dailySales.toLocaleString('es-CL')}</div>
            <p className="text-xs text-surface-500">+20.1% respecto a ayer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del mes</CardTitle>
            <DollarSign className="h-4 w-4 text-surface-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyIncome.toLocaleString('es-CL')}</div>
            <p className="text-xs text-surface-500">+15% respecto al mes anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes activos</CardTitle>
            <Users className="h-4 w-4 text-surface-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCustomers}</div>
            <p className="text-xs text-surface-500">+180 este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas pendientes</CardTitle>
            <Package className="h-4 w-4 text-surface-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingDeliveries}</div>
            <p className="text-xs text-surface-500">+7 desde ayer</p>
          </CardContent>
        </Card>
      </div>

      {/* Ventas Recientes y Productos Más Vendidos */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ventas Recientes</CardTitle>
            <CardDescription>
              Últimas 5 ventas realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {stats.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{sale.customer}</p>
                    <p className="text-sm text-surface-500">{sale.date}</p>
                  </div>
                  <div className="ml-auto font-medium">
                    +${sale.total.toLocaleString('es-CL')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Productos Más Vendidos</CardTitle>
            <CardDescription>
              Top 5 productos del mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {stats.topProducts.map((product, index) => (
                <div key={index} className="flex items-center">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{product.name}</p>
                    <p className="text-sm text-surface-500">{product.quantity} unidades</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventario y Alertas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Inventario</CardTitle>
            <CardDescription>
              Estado actual del inventario por categoría
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {['water', 'dispenser', 'accessory'].map((type) => (
                <div key={type} className="space-y-2">
                  <h4 className="text-sm font-medium text-surface-500 capitalize">{type}</h4>
                  <div className="grid gap-4">
                    {stats.inventory
                      .filter(item => item.product_type === type)
                      .map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">
                              {item.product_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{item.quantity} unidades</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              item.status === 'disponible' 
                                ? 'bg-green-100 text-green-700'
                                : item.status === 'reservado'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-surface-100 text-surface-700'
                            }`}>
                              {item.status}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>
              Alertas de stock bajo y otros avisos importantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.alerts.lowStock.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    Stock bajo de {item.product} ({item.quantity} unidades)
                  </span>
                </div>
              ))}
              {stats.alerts.lowStock.length === 0 && (
                <div className="text-green-600 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">No hay alertas de stock bajo</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}