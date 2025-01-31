import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types/customer';
import type { Sale, SaleItem } from '../types/sale';

export function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [currentSale, setCurrentSale] = useState<{
    items: SaleItem[];
    subtotal: number;
    tax: number;
    total: number;
  }>({
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transfer' | 'tarjeta' | 'pendiente'>('efectivo');

  useEffect(() => {
    loadSales();
    loadProducts();
  }, []);

  useEffect(() => {
    if (customerSearchTerm.length >= 2) {
      searchCustomers();
    } else {
      setCustomers([]);
    }
  }, [customerSearchTerm]);

  const searchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`full_name.ilike.%${customerSearchTerm}%,rut.ilike.%${customerSearchTerm}%`)
        .limit(5);

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error buscando clientes:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  };

  const loadSales = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(full_name, rut),
          items:order_items(
            id,
            product:products(code, name),
            quantity,
            unit_price,
            total_price
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedSales = (data || []).map((sale: any) => ({
        id: sale.id,
        sale_number: sale.id.slice(0, 8).toUpperCase(),
        customer_name: sale.customer?.full_name || 'Cliente no encontrado',
        customer_rut: sale.customer?.rut || 'RUT no disponible',
        date: new Date(sale.created_at).toLocaleDateString(),
        total: sale.total_amount,
        items: sale.items || []
      }));

      setSales(formattedSales);
    } catch (error) {
      console.error('Error cargando ventas:', error);
      setError('Error al cargar las ventas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async (productId: string) => {
    if (!productId) return;

    try {
      setModalError(null);
      // Verificar stock antes de agregar
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', productId)
        .single();

      if (inventoryError) throw inventoryError;

      if (!inventoryData || inventoryData.quantity <= 0) {
        setModalError(`No hay stock disponible para este producto`);
        return;
      }

      const product = products.find(p => p.id === productId);
      if (!product) return;

      // Verificar si el producto ya está en la lista
      const existingItem = currentSale.items.find(item => item.product_id === productId);
      if (existingItem) {
        // Si la nueva cantidad supera el stock, mostrar error
        if (existingItem.quantity >= inventoryData.quantity) {
          setModalError(`Solo hay ${inventoryData.quantity} unidades disponibles de este producto`);
          return;
        }
        // Incrementar cantidad si ya existe
        handleQuantityChange(existingItem.id, existingItem.quantity + 1);
      } else {
        // Agregar nuevo item
        const newItem: SaleItem = {
          id: Date.now(), // ID temporal
          product_id: product.id,
          product_code: product.code,
          product_name: product.name,
          quantity: 1,
          unit_price: product.price,
          subtotal: product.price
        };

        setCurrentSale(prev => {
          const items = [...prev.items, newItem];
          const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
          const tax = subtotal * 0.19;
          return {
            items,
            subtotal,
            tax,
            total: subtotal + tax
          };
        });
      }
    } catch (error: any) {
      console.error('Error al verificar stock:', error);
      setModalError('Error al verificar el stock disponible');
    }
  };

  const handleRemoveItem = (itemId: string) => {
    const updatedItems = currentSale.items.filter(item => item.id !== itemId);
    setCurrentSale(prev => {
      const subtotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const tax = subtotal * 0.19;
      return {
        items: updatedItems,
        subtotal,
        tax,
        total: subtotal + tax
      };
    });
  };

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) return;

    try {
      setModalError(null);
      const item = currentSale.items.find(i => i.id === itemId);
      if (!item) return;

      // Verificar stock antes de actualizar cantidad
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', item.product_id)
        .single();

      if (inventoryError) throw inventoryError;

      if (!inventoryData || inventoryData.quantity < newQuantity) {
        setModalError(`Solo hay ${inventoryData.quantity} unidades disponibles de este producto`);
        return;
      }

      setCurrentSale(prev => {
        const items = prev.items.map(i => {
          if (i.id === itemId) {
            return {
              ...i,
              quantity: newQuantity,
              subtotal: i.unit_price * newQuantity
            };
          }
          return i;
        });
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = subtotal * 0.19;
        return {
          items,
          subtotal,
          tax,
          total: subtotal + tax
        };
      });
    } catch (error: any) {
      console.error('Error al verificar stock:', error);
      setModalError('Error al verificar el stock disponible');
    }
  };

  const handleEditSale = async (sale: Sale) => {
    setIsLoading(true);
    try {
      // Cargar los detalles de la venta
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          items:order_items(
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            product:products(*)
          )
        `)
        .eq('id', sale.id)
        .single();

      if (orderError) throw orderError;

      if (!orderData) {
        throw new Error('No se encontró la venta');
      }

      // Preparar los datos para edición
      setSelectedCustomer(orderData.customer);
      setCustomerSearchTerm(orderData.customer.full_name);
      setEditingSale(sale);

      const formattedItems: SaleItem[] = orderData.items.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_code: item.product.code,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.total_price
      }));

      setCurrentSale({
        items: formattedItems,
        subtotal: formattedItems.reduce((sum, item) => sum + item.subtotal, 0),
        tax: orderData.total_amount - (orderData.total_amount / 1.19),
        total: orderData.total_amount
      });

      setIsModalOpen(true);
      setModalError(null);
    } catch (error) {
      console.error('Error cargando la venta:', error);
      alert('Error al cargar la venta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSale = async () => {
    if (!selectedCustomer || currentSale.items.length === 0) {
      alert('Por favor selecciona un cliente y agrega productos');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Verificar stock disponible
      for (const item of currentSale.items) {
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('product_id', item.product_id)
          .single();

        if (inventoryError) throw inventoryError;

        if (!inventoryData || inventoryData.quantity < item.quantity) {
          throw new Error(`Stock insuficiente para ${item.product_name}`);
        }
      }

      let orderId: number;

      if (editingSale) {
        // Actualizar venta existente
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .update({
            total_amount: currentSale.total,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingSale.id)
          .select()
          .single();

        if (orderError) throw orderError;
        if (!orderData) throw new Error('Error al actualizar la venta');
        
        orderId = editingSale.id;

        // Eliminar items anteriores
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', editingSale.id);

        if (deleteError) throw deleteError;

      } else {
        // Crear nueva venta
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert([{
            customer_id: selectedCustomer.id,
            total_amount: currentSale.total,
            status: 'confirmed',
            payment_status: paymentMethod === 'pendiente' ? 'pending' : 'paid',
            channel: 'in_person',
            payment_method: paymentMethod
          }])
          .select()
          .single();

        if (orderError) throw orderError;
        if (!orderData) throw new Error('Error al crear la venta');
        
        orderId = orderData.id;
      }

      // Crear los items de la venta
      const orderItems = currentSale.items.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.subtotal
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Actualizar inventario
      for (const item of currentSale.items) {
        const { error: updateError } = await supabase.rpc('update_inventory', {
          p_product_id: item.product_id,
          p_quantity: -item.quantity
        });

        if (updateError) throw updateError;
      }

      // Todo salió bien, mostrar mensaje de éxito
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      // Limpiar el formulario
      setIsModalOpen(false);
      setEditingSale(null);
      resetForm();
      
      // Recargar la lista de ventas
      await loadSales();

    } catch (error: any) {
      console.error('Error guardando la venta:', error);
      setError(error.message || 'Error al guardar la venta');
      // No cerramos el modal ni limpiamos el formulario en caso de error
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerSearchTerm('');
    setCurrentSale({
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0
    });
    setPaymentMethod('efectivo');
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setModalError(null);
    resetForm();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalError(null);
    resetForm();
  };

  const filteredSales = sales.filter(sale =>
    sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.customer_rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ventas</h1>
        <button
          onClick={handleOpenModal}
          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors duration-200 shadow-sm hover:shadow-md font-medium"
        >
          <Plus className="w-5 h-5" />
          Nueva Venta
        </button>
      </div>

      {showSuccess && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
          <div className="flex-shrink-0 text-green-600 dark:text-green-400">✓</div>
          <div className="text-green-700 dark:text-green-400">Venta guardada exitosamente</div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <div className="flex-shrink-0 text-red-600 dark:text-red-400">⚠</div>
          <div className="text-red-700 dark:text-red-400">{error}</div>
        </div>
      )}

      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar ventas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />
          <Search className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={18} />
        </div>
      </div>

      {isLoading && !isModalOpen ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Cargando ventas...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  N° Venta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  RUT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {sale.sale_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {sale.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {sale.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {sale.customer_rut}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    ${Math.round(sale.total).toLocaleString('es-CL')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleEditSale(sale)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-400 transition-colors"
                      title="Editar venta"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingSale ? 'Editar Venta' : 'Nueva Venta'}
                </h2>
                <button 
                  onClick={handleCloseModal} 
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cliente
                </label>
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre o RUT..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                {customers.length > 0 && !selectedCustomer && (
                  <div className="mt-2 border dark:border-gray-600 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto bg-white dark:bg-gray-700">
                    {customers.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerSearchTerm(customer.full_name);
                          setCustomers([]);
                        }}
                      >
                        <div className="font-medium text-gray-900 dark:text-white">{customer.full_name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">RUT: {customer.rut}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                  <h3 className="font-medium mb-2 text-gray-900 dark:text-white">Cliente seleccionado</h3>
                  <div className="grid grid-cols-2 gap-4 text-gray-600 dark:text-gray-300">
                    <p><span className="text-gray-500 dark:text-gray-400">Nombre:</span> {selectedCustomer.full_name}</p>
                    <p><span className="text-gray-500 dark:text-gray-400">RUT:</span> {selectedCustomer.rut}</p>
                    <p><span className="text-gray-500 dark:text-gray-400">Dirección:</span> {selectedCustomer.street} {selectedCustomer.number}</p>
                    <p><span className="text-gray-500 dark:text-gray-400">Comuna:</span> {selectedCustomer.district}</p>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <select
                    onChange={(e) => handleAddItem(e.target.value)}
                    value=""
                    className="flex-1 px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  >
                    <option value="">Seleccionar producto</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id} className="text-gray-900 dark:text-white">
                        {product.code} - {product.name} - ${Math.round(product.price).toLocaleString('es-CL')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Método de pago
                  </label>
                  <select
                    id="payment_method"
                    name="payment_method"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'efectivo' | 'transfer' | 'tarjeta' | 'pendiente')}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                </div>

                {modalError && (
                  <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                    {modalError}
                  </div>
                )}

                <div className="border dark:border-gray-600 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cantidad</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Precio</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subtotal</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {currentSale.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            {item.product_code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            {item.product_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value))}
                              className="w-20 px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            ${Math.round(item.unit_price).toLocaleString('es-CL')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                            ${Math.round(item.subtotal).toLocaleString('es-CL')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Eliminar producto"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="text-right space-y-2">
                    <div className="text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">${Math.round(currentSale.subtotal).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600 dark:text-gray-400">IVA (19%):</span>
                      <span className="ml-2 text-gray-900 dark:text-white">${Math.round(currentSale.tax).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="text-lg font-semibold">
                      <span className="text-gray-900 dark:text-white">Total:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">${Math.round(currentSale.total).toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-200 font-medium shadow-sm hover:shadow-md border border-gray-300 dark:border-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSale}
                  disabled={!selectedCustomer || currentSale.items.length === 0 || isLoading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-b-white"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    'Completar Venta'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}