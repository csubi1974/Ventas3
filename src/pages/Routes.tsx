import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, X, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Customer } from '../types/customer';
import type { DeliveryRoute } from '../types/delivery';
import type { Product } from '../types/product';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function Routes() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryRoute[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<{
    id: string;
    product: Product;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[]>([]);
  const [formData, setFormData] = useState({
    order: 1,
    bottles_to_deliver: 0,
    bottles_to_collect: 0,
    observation: '',
    payment_method: 'efectivo' as 'efectivo' | 'transfer' | 'tarjeta' | 'pendiente',
    payment_amount: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (user) {
      loadDeliveryRoute();
      loadProducts();
    }
  }, [currentDate, user]);

  useEffect(() => {
    const searchCustomers = async () => {
      if (!user || customerSearchTerm.length < 2) {
        setCustomers([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .or(`full_name.ilike.%${customerSearchTerm}%,rut.ilike.%${customerSearchTerm}%,code.ilike.%${customerSearchTerm}%`)
          .order('full_name')
          .limit(10);

        if (error) throw error;
        setCustomers(data || []);
      } catch (error) {
        console.error('Error searching customers:', error);
        setError('Error al buscar clientes');
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounceTimer);
  }, [customerSearchTerm, user]);

  const loadProducts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setError('Error al cargar productos');
    }
  };

  const loadDeliveryRoute = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('delivery_routes')
        .select(`
          *,
          customer:customers(
            id,
            full_name,
            code,
            phone,
            street,
            number,
            district,
            city
          ),
          items:delivery_route_items(
            id,
            product:products(
              code,
              name,
              type,
              price
            ),
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('date', currentDate)
        .order('order');

      if (error) throw error;

      const formattedData = data.map(route => ({
        id: route.id,
        date: route.date,
        order: route.order,
        customer: {
          id: route.customer.id,
          name: route.customer.full_name,
          code: route.customer.code,
          phone: route.customer.phone,
          address: `${route.customer.street} ${route.customer.number}, ${route.customer.district}, ${route.customer.city}`
        },
        items: route.items,
        bottles_to_deliver: route.bottles_to_deliver,
        bottles_to_collect: route.bottles_to_collect,
        bottles_in_circulation: route.bottles_in_circulation,
        bottles_owned: route.bottles_owned,
        bottles_balance: route.bottles_balance,
        observation: route.observation,
        subtotal: route.subtotal,
        tax: route.tax,
        total: route.total,
        payment: {
          amount: route.payment_amount,
          method: route.payment_method
        },
        sale_type: route.sale_type,
        sale_status: route.sale_status,
        status: route.status
      }));

      setDeliveryItems(formattedData);
    } catch (error) {
      console.error('Error loading delivery route:', error);
      setError('Error al cargar la ruta de reparto');
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta entrega?')) return;

    try {
      const { error } = await supabase
        .from('delivery_routes')
        .delete()
        .eq('id', routeId);

      if (error) throw error;
      loadDeliveryRoute();
    } catch (error) {
      console.error('Error deleting route:', error);
      setError('Error al eliminar la entrega');
    }
  };

  const handleAddProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingProduct = selectedProducts.find(p => p.id === productId);
    if (existingProduct) {
      setSelectedProducts(selectedProducts.map(p =>
        p.id === productId
          ? {
              ...p,
              quantity: p.quantity + 1,
              total_price: (p.quantity + 1) * p.unit_price
            }
          : p
      ));

      // Si es Recarga Agua Purificada 20L, actualizar botellones a entregar
      if (product.name === 'Recarga Agua Purificada 20L') {
        setFormData(prev => ({
          ...prev,
          bottles_to_deliver: prev.bottles_to_deliver + 1
        }));
      }
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          id: productId,
          product,
          quantity: 1,
          unit_price: product.price,
          total_price: product.price
        }
      ]);

      // Si es Recarga Agua Purificada 20L, actualizar botellones a entregar
      if (product.name === 'Recarga Agua Purificada 20L') {
        setFormData(prev => ({
          ...prev,
          bottles_to_deliver: prev.bottles_to_deliver + 1
        }));
      }
    }
  };

  const handleRemoveProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    const removedProduct = selectedProducts.find(p => p.id === productId);
    
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));

    // Si es Recarga Agua Purificada 20L, actualizar botellones a entregar
    if (product?.name === 'Recarga Agua Purificada 20L' && removedProduct) {
      setFormData(prev => ({
        ...prev,
        bottles_to_deliver: Math.max(0, prev.bottles_to_deliver - removedProduct.quantity)
      }));
    }
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity < 1) return;

    const product = products.find(p => p.id === productId);
    const oldProduct = selectedProducts.find(p => p.id === productId);

    setSelectedProducts(selectedProducts.map(p =>
      p.id === productId
        ? {
            ...p,
            quantity,
            total_price: quantity * p.unit_price
          }
        : p
    ));

    // Si es Recarga Agua Purificada 20L, actualizar botellones a entregar
    if (product?.name === 'Recarga Agua Purificada 20L' && oldProduct) {
      const difference = quantity - oldProduct.quantity;
      setFormData(prev => ({
        ...prev,
        bottles_to_deliver: Math.max(0, prev.bottles_to_deliver + difference)
      }));
    }
  };

  const calculateTotals = () => {
    const subtotal = selectedProducts.reduce((sum, p) => sum + p.total_price, 0);
    const tax = subtotal * 0.19;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer || selectedProducts.length === 0) {
      alert('Por favor selecciona un cliente y agrega productos');
      return;
    }

    const { subtotal, tax, total } = calculateTotals();

    try {
      // Get current bottles balance for the customer
      const { data: customerData } = await supabase
        .from('customers')
        .select('bottles_lent, bottles_owned')
        .eq('id', selectedCustomer.id)
        .single();

      // Create the delivery route
      const { data: routeData, error: routeError } = await supabase
        .from('delivery_routes')
        .insert([{
          date: currentDate,
          order: formData.order,
          customer_id: selectedCustomer.id,
          bottles_to_deliver: formData.bottles_to_deliver,
          bottles_to_collect: formData.bottles_to_collect,
          bottles_in_circulation: customerData?.bottles_lent || 0,
          bottles_owned: customerData?.bottles_owned || 0,
          observation: formData.observation,
          payment_amount: formData.payment_amount || total,
          payment_method: formData.payment_method,
          sale_type: 'scheduled',
          sale_status: formData.payment_method === 'pendiente' ? 'pending' : 'confirmed',
          subtotal,
          tax,
          total
        }])
        .select()
        .single();

      if (routeError) throw routeError;

      // Create the route items
      const routeItems = selectedProducts.map(p => ({
        delivery_route_id: routeData.id,
        product_id: p.id,
        quantity: p.quantity,
        unit_price: p.unit_price,
        total_price: p.total_price
      }));

      const { error: itemsError } = await supabase
        .from('delivery_route_items')
        .insert(routeItems);

      if (itemsError) throw itemsError;

      // Clear the form
      setIsModalOpen(false);
      setSelectedCustomer(null);
      setSelectedProducts([]);
      setFormData({
        order: 1,
        bottles_to_deliver: 0,
        bottles_to_collect: 0,
        observation: '',
        payment_method: 'efectivo',
        payment_amount: 0
      });
      setCustomerSearchTerm('');
      loadDeliveryRoute();
    } catch (error) {
      console.error('Error saving delivery route:', error);
      setError('Error al guardar la ruta de reparto');
    }
  };

  const generatePDF = async () => {
    setIsPrinting(true);
    try {
      const doc = new jsPDF();
      
      // Add header
      doc.setFontSize(20);
      doc.text('Ruta de Reparto', 105, 15, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Fecha: ${new Date(currentDate).toLocaleDateString('es-CL')}`, 105, 25, { align: 'center' });
      
      // Calcular totales
      const totalBottles = filteredDeliveryItems.reduce((sum, item) => sum + item.bottles_to_deliver, 0);
      const totalSales = filteredDeliveryItems.reduce((sum, item) => sum + item.total, 0);
      
      // Agregar resumen de totales
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Resumen:', 15, 35);
      doc.setFont(undefined, 'normal');
      doc.text(`Total Botellones a Entregar: ${totalBottles}`, 15, 42);
      doc.text(`Total Venta: $${Math.round(totalSales).toLocaleString('es-CL')}`, 105, 42);
      
      // Add routes table
      const tableData = filteredDeliveryItems.map(item => [
        item.order.toString(),
        item.customer.name,
        item.customer.code,
        item.customer.phone || '',
        item.customer.address,
        item.items.map(p => `${p.quantity}x ${p.product.name}`).join('\n'),
        `Entregar: ${item.bottles_to_deliver}\nRecoger: ${item.bottles_to_collect}`,
        item.observation || '',
        `$${Math.round(item.total).toLocaleString('es-CL')}\n${
          item.payment.method === 'efectivo' ? 'Efectivo' :
          item.payment.method === 'transfer' ? 'Transferencia' :
          item.payment.method === 'tarjeta' ? 'Tarjeta' :
          'Pendiente'
        }`
      ]);

      (doc as any).autoTable({
        head: [['Orden', 'Cliente', 'Código', 'Teléfono', 'Dirección', 'Productos', 'Botellones', 'Obs.', 'Total']],
        body: tableData,
        startY: 50,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 1,
          overflow: 'linebreak',
          lineWidth: 0.1
        },
        columnStyles: {
          0: { cellWidth: 10 },  // Orden
          1: { cellWidth: 25 },  // Cliente
          2: { cellWidth: 15 },  // Código
          3: { cellWidth: 15 },  // Teléfono
          4: { cellWidth: 30 },  // Dirección
          5: { cellWidth: 25 },  // Productos
          6: { cellWidth: 15 },  // Botellones
          7: { cellWidth: 25 },  // Observación
          8: { cellWidth: 20 }   // Total
        },
        headStyles: {
          fillColor: [63, 102, 241],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 7
        },
        margin: { left: 10, right: 10 },
        didDrawPage: function(data: any) {
          // Footer
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
          doc.setFontSize(8);
          doc.text(
            `Página ${data.pageNumber}`,
            data.settings.margin.left,
            pageHeight - 10
          );
          doc.text(
            new Date().toLocaleString('es-CL'),
            pageSize.width - 40,
            pageHeight - 10
          );
        }
      });

      // Save the PDF
      doc.save(`ruta-reparto-${currentDate}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Error al generar el PDF');
    } finally {
      setIsPrinting(false);
    }
  };

  const filteredDeliveryItems = deliveryItems.filter(item =>
    item.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.customer.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-surface-500">Debes iniciar sesión para ver esta página</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-white">Rutas de Reparto</h1>
        <div className="flex gap-4">
          <input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-800 dark:border-surface-600 dark:text-white"
          />
          <button
            onClick={generatePDF}
            disabled={isPrinting || filteredDeliveryItems.length === 0}
            className="bg-surface-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-5 w-5" />
            {isPrinting ? 'Generando...' : 'Imprimir PDF'}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary-700"
          >
            <Plus className="h-5 w-5" />
            Nueva Entrega
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-surface-800 shadow rounded-lg">
        <div className="p-4 border-b border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-surface-400" />
            <input
              type="text"
              placeholder="Buscar por cliente o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border-none focus:ring-0 bg-transparent text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 dark:divide-surface-700">
            <thead className="bg-surface-50 dark:bg-surface-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Orden
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Dirección
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Productos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Botellones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Observación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-800 divide-y divide-surface-200 dark:divide-surface-700">
              {filteredDeliveryItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-surface-500">
                    No hay entregas programadas para esta fecha
                  </td>
                </tr>
              ) : (
                filteredDeliveryItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900 dark:text-white">
                      {item.order}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900 dark:text-white">
                      {item.customer.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900 dark:text-white">
                      {item.customer.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900 dark:text-white">
                      {item.customer.phone}
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-900 dark:text-white">
                      {item.customer.address}
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-900 dark:text-white">
                      <ul className="list-disc list-inside">
                        {item.items.map((product) => (
                          <li key={product.id}>
                            {product.quantity}x {product.product.name}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900 dark:text-white">
                      <div>Entregar: {item.bottles_to_deliver}</div>
                      <div>Recoger: {item.bottles_to_collect}</div>
                      <div>Balance: {item.bottles_balance}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-surface-900 dark:text-white">
                      {item.observation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium text-surface-900 dark:text-white">
                          ${Math.round(item.total).toLocaleString('es-CL')}
                        </span>
                        <span className={`text-xs ${
                          item.payment.method === 'efectivo' ? 'text-green-600 dark:text-green-400' :
                          item.payment.method === 'transfer' ? 'text-blue-600 dark:text-blue-400' :
                          item.payment.method === 'tarjeta' ? 'text-orange-600 dark:text-orange-400' :
                          'text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {item.payment.method === 'efectivo' ? 'Efectivo' :
                           item.payment.method === 'transfer' ? 'Transferencia' :
                           item.payment.method === 'tarjeta' ? 'Tarjeta' :
                           'Pendiente'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                      <button
                        onClick={() => handleDeleteRoute(item.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Eliminar entrega"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-surface-500 bg-opacity-75 flex items-start justify-center overflow-y-auto">
          <div className="relative bg-white dark:bg-surface-800 rounded-lg w-full max-w-4xl my-8 mx-4">
            {/* Modal Header - Fixed */}
            <div className="sticky top-0 bg-white dark:bg-surface-800 px-6 py-4 border-b border-surface-200 dark:border-surface-700 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-surface-900 dark:text-white">Nueva Entrega</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-surface-400 hover:text-surface-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="px-6 py-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
              <form id="delivery-form" onSubmit={handleSubmit} className="space-y-6">
                {/* Orden */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Orden
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                    className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:border-surface-600 dark:text-white"
                  />
                </div>

                {/* Búsqueda de cliente */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Cliente
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar por nombre, RUT o código..."
                      value={customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setSelectedCustomer(null);
                      }}
                      className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:border-surface-600 dark:text-white"
                    />
                    {customerSearchTerm.length >= 2 && customers.length > 0 && !selectedCustomer && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-surface-700 shadow-lg rounded-md border border-surface-200 dark:border-surface-600 max-h-60 overflow-auto">
                        {customers.map((customer) => (
                          <div
                            key={customer.id}
                            className="px-4 py-2 hover:bg-surface-50 dark:hover:bg-surface-600 cursor-pointer"
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setCustomerSearchTerm(`${customer.full_name} - ${customer.rut}`);
                            }}
                          >
                            <div className="font-medium text-surface-900 dark:text-white">{customer.full_name}</div>
                            <div className="text-sm text-surface-500 dark:text-surface-400">
                              RUT: {customer.rut} - Código: {customer.code}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Información del cliente seleccionado */}
                {selectedCustomer && (
                  <div className="bg-surface-50 dark:bg-surface-700 p-4 rounded-lg">
                    <h3 className="font-medium text-surface-900 dark:text-white mb-2">Datos del cliente</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-surface-500 dark:text-surface-400">Nombre:</span>{' '}
                        <span className="text-surface-900 dark:text-white">{selectedCustomer.full_name}</span>
                      </div>
                      <div>
                        <span className="text-surface-500 dark:text-surface-400">RUT:</span>{' '}
                        <span className="text-surface-900 dark:text-white">{selectedCustomer.rut}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-surface-500 dark:text-surface-400">Dirección:</span>{' '}
                        <span className="text-surface-900 dark:text-white">
                          {`${selectedCustomer.street} ${selectedCustomer.number}, ${selectedCustomer.district}, ${selectedCustomer.city}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Agregar productos */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Productos
                  </label>
                  <select
                    onChange={(e) => handleAddProduct(e.target.value)}
                    value=""
                    className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:border-surface-600 dark:text-white"
                  >
                    <option value="">Agregar producto</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.code} - {product.name} - ${product.price.toLocaleString('es-CL')}
                      </option>
                    ))}
                  </select>

                  {selectedProducts.length > 0 && (
                    <div className="mt-4">
                      <table className="min-w-full divide-y divide-surface-200 dark:divide-surface-700">
                        <thead className="bg-surface-50 dark:bg-surface-700">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-surface-500 uppercase">Producto</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-surface-500 uppercase">Cantidad</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-surface-500 uppercase">Precio</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-surface-500 uppercase">Total</th>
                            <th className="px-4 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-surface-800 divide-y divide-surface-200 dark:divide-surface-700">
                          {selectedProducts.map((p) => (
                            <tr key={p.id}>
                              <td className="px-4 py-2 text-sm text-surface-900 dark:text-white">{p.product.name}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={p.quantity}
                                  onChange={(e) => handleQuantityChange(p.id, parseInt(e.target.value) || 1)}
                                  className="w-20 rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:border-surface-600 dark:text-white"
                                />
                              </td>
                              <td className="px-4 py-2 text-sm text-surface-900 dark:text-white">
                                ${p.unit_price.toLocaleString('es-CL')}
                              </td>
                              <td className="px-4 py-2 text-sm text-surface-900 dark:text-white">
                                ${p.total_price.toLocaleString('es-CL')}
                              </td>
                              <td className="px-4 py-2">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProduct(p.id)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-surface-50 dark:bg-surface-700">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-medium text-right text-surface-900 dark:text-white">
                              Subtotal:
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-surface-900 dark:text-white">
                              ${calculateTotals().subtotal.toLocaleString('es-CL')}
                            </td>
                            <td></td>
                          </tr>
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-medium text-right text-surface-900 dark:text-white">
                              IVA (19%):
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-surface-900 dark:text-white">
                              ${calculateTotals().tax.toLocaleString('es-CL')}
                            </td>
                            <td></td>
                          </tr>
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-medium text-right text-surface-900 dark:text-white">
                              Total:
                            </td>
                            <td className="px-4 py-2 text-sm font-medium text-surface-900 dark:text-white">
                              ${calculateTotals().total.toLocaleString('es-CL')}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Botellones */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                      Botellones a entregar
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.bottles_to_deliver}
                      onChange={(e) => setFormData({ ...formData, bottles_to_deliver: parseInt(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:border-surface-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                      Botellones a recoger
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.bottles_to_collect}
                      onChange={(e) => setFormData({ ...formData, bottles_to_collect: parseInt(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:border-surface-600 dark:text-white"
                    />
                  </div>
                </div>

                {/* Observación */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Observación
                  </label>
                  <textarea
                    value={formData.observation}
                    onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                    rows={2}
                    className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:border-surface-600 dark:text-white"
                  />
                </div>

                {/* Método de pago */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                    Método de pago
                  </label>
                  <select
                    id="payment_method"
                    name="payment_method"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as 'efectivo' | 'transfer' | 'tarjeta' | 'pendiente' })}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                </div>
              </form>
            </div>

            {/* Modal Footer - Fixed */}
            <div className="sticky bottom-0 bg-white dark:bg-surface-800 px-6 py-4 border-t border-surface-200 dark:border-surface-700 rounded-b-lg">
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 bg-white dark:bg-surface-700 border border-surface-300 dark:border-surface-600 rounded-md hover:bg-surface-50 dark:hover:bg-surface-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="delivery-form"
                  disabled={!selectedCustomer || selectedProducts.length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}