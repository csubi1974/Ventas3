import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  X,
  Save,
  MapPin,
  Phone,
  User,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import type { Customer } from '@/types/customer';
import type { Product } from '@/types/product';
import type { Database } from '@/types/database';

type Sale = Database['public']['Tables']['orders']['Insert'];
type SaleItem = Database['public']['Tables']['order_items']['Insert'];

interface CartItem {
  product: Product;
  quantity: number;
}

interface InventoryItem {
  product_id: string;
  quantity: number;
}

const MobileSales = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transfer' | 'tarjeta' | 'pendiente'>('efectivo');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*, inventory(quantity)')
        .eq('active', true)
        .order('name');

      if (productsError) throw productsError;

      const products = productsData?.map(p => ({
        ...p,
        stock: p.inventory?.[0]?.quantity || 0
      })) || [];

      setProducts(products);
      setIsLoading(false);
    } catch (err) {
      console.error('Error cargando productos:', err);
      setError('Error al cargar los productos');
      setIsLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    setCustomerSearchTerm(value);
    if (!value || value.length < 2) {
      setCustomers([]);
      return;
    }

    try {
      const searchValue = value.toLowerCase().trim();
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`full_name.ilike.%${searchValue}%,rut.ilike.%${searchValue}%,code.ilike.%${searchValue}%`)
        .order('full_name')
        .limit(5);

      if (error) throw error;
      setCustomers(data || []);
      setError(null);
    } catch (err) {
      console.error('Error buscando clientes:', err);
      setError('Error al buscar clientes');
      setCustomers([]);
    }
  };

  const addToCart = (product: Product) => {
    if (getAvailableStock(product.id) <= 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const updated = prev.map(item => {
        if (item.product.id === productId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          if (newQuantity > getAvailableStock(productId)) return item;
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter((item): item is CartItem => item !== null);
      return updated;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const getAvailableStock = (productId: string): number => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    
    const cartItem = cart.find(item => item.product.id === productId);
    const inCart = cartItem?.quantity || 0;
    
    return (product.stock || 0) - inCart;
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
    const tax = subtotal * 0.19; // 19% IVA
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleCompleteSale = async () => {
    if (!selectedCustomer || cart.length === 0 || !user?.id) {
      setError('Selecciona un cliente y agrega productos al carrito');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setShowSuccess(false);

    try {
      // 1. Crear la venta
      const totals = calculateTotals();
      const orderData = {
        customer_id: selectedCustomer.id,
        total_amount: totals.total,
        status: 'confirmed',
        payment_status: paymentMethod === 'pendiente' ? 'pending' : 'paid',
        channel: 'in_person'
      };

      console.log('Datos de la venta a insertar:', orderData);

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error('Error detallado al crear la venta:', orderError);
        throw new Error(`Error al crear la venta: ${orderError.message || 'Error desconocido'}`);
      }

      if (!newOrder) {
        throw new Error('No se pudo obtener el ID de la venta');
      }

      console.log('Venta creada:', newOrder);

      // 2. Crear los items de la venta
      const orderItems = cart.map(item => ({
        order_id: newOrder.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity
      }));

      console.log('Items de venta a insertar:', orderItems);

      const { data: newItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select();

      console.log('Respuesta de items:', { data: newItems, error: itemsError });

      if (itemsError) {
        console.error('Error detallado al crear los items:', itemsError);
        throw new Error(`Error al crear los items: ${itemsError.message || 'Error desconocido'}`);
      }

      // 3. Actualizar el inventario para cada producto
      for (const item of cart) {
        console.log('Actualizando inventario para producto:', {
          productId: item.product.id,
          quantity: -item.quantity
        });

        const { data: invData, error: inventoryError } = await supabase
          .rpc('update_inventory', {
            p_product_id: item.product.id,
            p_quantity: -item.quantity
          });

        console.log('Respuesta de inventario:', { data: invData, error: inventoryError });

        if (inventoryError) {
          console.error('Error detallado al actualizar inventario:', inventoryError);
          throw new Error(`Error al actualizar inventario: ${inventoryError.message || 'Error desconocido'}`);
        }
      }

      // 4. Limpiar el carrito y mostrar mensaje de éxito
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearchTerm('');
      setPaymentMethod('efectivo');
      loadProducts(); // Recargar productos para actualizar stock
      
    } catch (err) {
      console.error('Error completo:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === 'object' && err !== null) {
        setError(JSON.stringify(err, null, 2));
      } else {
        setError('Error desconocido al procesar la venta');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4">
      <h2 className="text-sm text-gray-400 mb-4">Registra ventas directamente desde tu dispositivo móvil</h2>

      {/* Cliente */}
      <div className="mb-6">
        <label className="text-sm mb-2 block">Cliente</label>
        <input
          type="text"
          value={customerSearchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full p-2 rounded bg-[#1e293b] border border-gray-700 text-white"
        />
        
        {selectedCustomer ? (
          <div className="mt-3 p-4 bg-[#1e293b] rounded-lg">
            <div className="flex items-start gap-3 mb-2">
              <User size={18} className="text-gray-400 mt-1" />
              <span>{selectedCustomer.full_name}</span>
            </div>
            {selectedCustomer.street && (
              <div className="flex items-start gap-3 mb-2">
                <MapPin size={18} className="text-gray-400 mt-1" />
                <span>{selectedCustomer.street} {selectedCustomer.number}</span>
              </div>
            )}
            {selectedCustomer.phone && (
              <div className="flex items-start gap-3">
                <Phone size={18} className="text-gray-400 mt-1" />
                <span>{selectedCustomer.phone}</span>
              </div>
            )}
          </div>
        ) : (
          customers.length > 0 && (
            <div className="mt-1 bg-[#1e293b] border border-gray-700 rounded-lg overflow-hidden">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setCustomerSearchTerm(customer.full_name);
                    setCustomers([]);
                  }}
                  className="w-full p-3 text-left hover:bg-[#2e3b4b] border-b border-gray-700 last:border-0"
                >
                  <div className="font-medium">{customer.full_name}</div>
                  {customer.rut && <div className="text-sm text-gray-400">{customer.rut}</div>}
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {/* Productos Disponibles */}
      <h3 className="text-lg font-medium mb-4">Productos Disponibles</h3>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {products.map((product) => {
          const stock = getAvailableStock(product.id);
          return (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              disabled={stock <= 0}
              className={`p-4 bg-[#1e293b] rounded-lg text-left transition-colors ${
                stock <= 0 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-[#2e3b4b] cursor-pointer'
              }`}
            >
              <h4 className="font-medium mb-1">{product.name}</h4>
              <p className="text-blue-400 mb-2">${product.price.toLocaleString()}</p>
              <p className={`text-sm ${stock <= 0 ? 'text-red-400' : 'text-gray-400'}`}>
                Stock disponible: {stock}
              </p>
            </button>
          );
        })}
      </div>

      {/* Carrito de Compras */}
      {cart.length > 0 && (
        <div className="bg-[#1e293b] rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium mb-4">Carrito de Compras</h3>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{item.product.name}</h4>
                  <p className="text-blue-400">${item.product.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2e3b4b] hover:bg-[#3e4b5b]"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2e3b4b] hover:bg-[#3e4b5b]"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span>${calculateTotals().subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>IVA (19%)</span>
              <span>${calculateTotals().tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-medium pt-2 border-t border-gray-700">
              <span>Total</span>
              <span>${calculateTotals().total.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-medium mb-2">Método de Pago</h4>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'efectivo' | 'transfer' | 'tarjeta' | 'pendiente')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white sm:text-sm"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>

          <button
            onClick={handleCompleteSale}
            disabled={isProcessing || !selectedCustomer}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ShoppingCart size={20} />
            {isProcessing ? 'Procesando...' : 'Procesar Venta'}
          </button>
        </div>
      )}

      {/* Mensajes de estado */}
      {showSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-500/90 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          Venta procesada exitosamente
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} />
            <span className="font-medium">Error</span>
          </div>
          <div className="text-sm whitespace-pre-wrap">{error}</div>
        </div>
      )}
    </div>
  );
};

export default MobileSales;