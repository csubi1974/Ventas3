import React, { useState, useEffect } from 'react';
import { Plus, Search, History, AlertTriangle, Package, ArrowDown, ArrowUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { InventoryItem, InventoryMovement, InventoryAlert } from '../types/inventory';
import type { Product } from '../types/product';

export function Inventory() {
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'alerts'>('stock');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<'entrada' | 'salida'>('entrada');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInventory();
    loadMovements();
    loadAlerts();
    loadProducts();
  }, []);

  const loadInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          product:products(code, name, type)
        `)
        .order('last_count_date', { ascending: false });

      if (error) throw error;

      // Filtrar items sin productos
      setInventory(data.filter(item => item.product !== null));
    } catch (error) {
      console.error('Error loading inventory:', error);
      setError('Error al cargar el inventario');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMovements = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          inventory:inventory(
            product:products(code, name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMovements(data);
    } catch (error) {
      console.error('Error loading movements:', error);
      setError('Error al cargar los movimientos');
    }
  };

  const loadAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_alerts')
        .select(`
          *,
          product:products(code, name)
        `);

      if (error) throw error;
      setAlerts(data.filter(alert => alert.product !== null));
    } catch (error) {
      console.error('Error loading alerts:', error);
      setError('Error al cargar las alertas');
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
      console.error('Error loading products:', error);
      setError('Error al cargar los productos');
    }
  };

  const handleMovement = async () => {
    if (!selectedProduct || quantity < 1) return;

    try {
      let inventoryItem = inventory.find(item => item.product_id === selectedProduct);
      if (!inventoryItem) {
        // Si no existe un registro de inventario, crear uno nuevo
        const { data: newInventory, error: createError } = await supabase
          .from('inventory')
          .insert([{
            product_id: selectedProduct,
            quantity: 0,
            type: 'in_circulation',
            location: 'almacen',
            status: 'disponible',
            condition: 'nuevo'
          }])
          .select()
          .single();

        if (createError) throw createError;
        inventoryItem = newInventory;
      }

      const newQuantity = movementType === 'entrada' 
        ? inventoryItem.quantity + quantity
        : inventoryItem.quantity - quantity;

      if (newQuantity < 0) {
        alert('No hay suficiente stock para realizar esta operación');
        return;
      }

      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert([{
          inventory_id: inventoryItem.id,
          type: movementType,
          quantity: quantity,
          previous_quantity: inventoryItem.quantity,
          new_quantity: newQuantity,
          notes: notes,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (movementError) throw movementError;

      const { error: inventoryError } = await supabase
        .from('inventory')
        .update({ 
          quantity: newQuantity,
          last_count_date: new Date().toISOString()
        })
        .eq('id', inventoryItem.id);

      if (inventoryError) throw inventoryError;

      setIsModalOpen(false);
      setSelectedProduct(null);
      setQuantity(1);
      setNotes('');
      loadInventory();
      loadMovements();
    } catch (error) {
      console.error('Error registering movement:', error);
      alert('Error al registrar el movimiento');
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

  const filteredInventory = inventory.filter(item =>
    item.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product?.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Inventario</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          <Plus className="h-5 w-5" />
          Registrar Movimiento
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('stock')}
              className={`${
                activeTab === 'stock'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              } flex whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
            >
              <Package className="h-5 w-5 mr-2" />
              Inventario
            </button>

            <button
              onClick={() => setActiveTab('movements')}
              className={`${
                activeTab === 'movements'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              } flex whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
            >
              <History className="h-5 w-5 mr-2" />
              Movimientos
            </button>

            <button
              onClick={() => setActiveTab('alerts')}
              className={`${
                activeTab === 'alerts'
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              } flex whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
            >
              <AlertTriangle className="h-5 w-5 mr-2" />
              Alertas
            </button>
          </nav>
        </div>

        <div className="p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-200 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
              placeholder="Buscar..."
            />
          </div>
        </div>

        {activeTab === 'stock' && (
          <div className="mt-4">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock Actual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Último Conteo</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.product?.name}
                      <div className="text-sm text-gray-500 dark:text-gray-400">{item.product?.code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.last_count_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Registrar Movimiento</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleMovement();
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Tipo de Movimiento</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <button
                    type="button"
                    onClick={() => setMovementType('entrada')}
                    className={`flex-1 inline-flex justify-center items-center px-4 py-2 rounded-l-md border ${
                      movementType === 'entrada'
                        ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-500 dark:border-blue-400 dark:text-blue-300'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ArrowDown className="h-5 w-5 mr-2" />
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('salida')}
                    className={`flex-1 inline-flex justify-center items-center px-4 py-2 rounded-r-md border ${
                      movementType === 'salida'
                        ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-500 dark:border-blue-400 dark:text-blue-300'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ArrowUp className="h-5 w-5 mr-2" />
                    Salida
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Producto</label>
                <select
                  value={selectedProduct || ''}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  required
                >
                  <option value="">Seleccionar producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.code} - {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
                  placeholder="Detalles adicionales del movimiento..."
                />
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedProduct(null);
                    setQuantity(1);
                    setNotes('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
                >
                  Registrar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}