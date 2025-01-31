import React, { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Search, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types/customer';
import * as XLSX from 'xlsx';

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Customer | 'address';
    direction: 'asc' | 'desc';
  } | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    rut: '',
    full_name: '',
    type: 'personal',
    street: '',
    number: '',
    district: '',
    city: '',
    reference: '',
    phone: '',
    email: '',
    contact: '',
    comments: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const filtered = customers.filter((customer) => {
      const searchFields = [
        customer.code,
        customer.rut,
        customer.full_name,
        customer.street,
        customer.district,
        customer.city,
        customer.phone,
        customer.email
      ].map(field => (field || '').toLowerCase());
      
      const searchTermLower = searchTerm.toLowerCase();
      return searchFields.some(field => field.includes(searchTermLower));
    });
    
    // Mantener el ordenamiento actual si existe
    if (sortConfig) {
      const { key, direction } = sortConfig;
      filtered.sort((a, b) => {
        let aValue: string;
        let bValue: string;
        
        if (key === 'address') {
          aValue = `${a.street} ${a.number}, ${a.district}, ${a.city}`.toLowerCase();
          bValue = `${b.street} ${b.number}, ${b.district}, ${b.city}`.toLowerCase();
        } else {
          aValue = (a[key] || '').toString().toLowerCase();
          bValue = (b[key] || '').toString().toLowerCase();
        }
        
        if (direction === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });
    }
    
    setFilteredCustomers(filtered);
  }, [searchTerm, customers, sortConfig]);

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading customers:', error);
      return;
    }

    setCustomers(data);
  };

  const validateRut = (rut: string) => {
    if (!rut) return true; // Permitir RUT vacío
    const rutRegex = /^(\d{1,2}\.\d{3}\.\d{3}-[\dkK]|\d{7,8}-[\dkK])$/;
    return rutRegex.test(rut);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar RUT solo si está presente o si es empresa
    if ((formData.rut || formData.type === 'business') && !validateRut(formData.rut)) {
      alert('RUT inválido. Formato esperado: 12.345.678-9 o 12345678-9');
      return;
    }

    // Si es cliente particular y no hay RUT, asegurarnos que sea null en la BD
    const dataToSave = {
      ...formData,
      rut: formData.type === 'personal' && !formData.rut ? null : formData.rut
    };

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(dataToSave)
          .eq('id', editingCustomer.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([dataToSave]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingCustomer(null);
      setFormData({
        code: '',
        rut: '',
        full_name: '',
        type: 'personal',
        street: '',
        number: '',
        district: '',
        city: '',
        reference: '',
        phone: '',
        email: '',
        contact: '',
        comments: ''
      });
      loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error al guardar el cliente');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      code: customer.code,
      rut: customer.rut,
      full_name: customer.full_name,
      type: customer.type,
      street: customer.street,
      number: customer.number,
      district: customer.district,
      city: customer.city,
      reference: customer.reference || '',
      phone: customer.phone || '',
      email: customer.email || '',
      contact: customer.contact || '',
      comments: customer.comments || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente?')) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('Error al eliminar el cliente');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Obtener el último código existente
        const { data: existingCustomers, error: fetchError } = await supabase
          .from('customers')
          .select('code')
          .order('code', { ascending: false })
          .limit(1);

        if (fetchError) {
          throw fetchError;
        }

        // Determinar el siguiente código
        let lastNumber = 0;
        if (existingCustomers && existingCustomers.length > 0) {
          const lastCode = existingCustomers[0].code;
          const match = lastCode.match(/CLI(\d+)/);
          if (match) {
            lastNumber = parseInt(match[1]);
          }
        }

        // Validar y transformar datos
        const customers = jsonData.map((row: any, index: number) => {
          // Generar el siguiente código
          lastNumber++;
          const code = `CLI${String(lastNumber).padStart(3, '0')}`;

          return {
            code,
            full_name: row.full_name,
            rut: row.rut || null,
            phone: row.phone?.toString(),
            email: row.email,
            street: row.street,
            number: row.number?.toString(),
            district: row.district,
            city: row.city,
            reference: row.reference,
            type: row.type === 'business' ? 'business' : 'personal',
            bottles_owned: parseInt(row.bottles_owned) || 0,
            bottles_lent: parseInt(row.bottles_lent) || 0,
            credit_limit: parseFloat(row.credit_limit) || 0,
            contact: row.contact,
            comments: row.comments
          };
        });

        // Validar datos requeridos
        const invalidCustomers = customers.filter(
          c => !c.full_name || !c.street || !c.number || !c.district || !c.city
        );

        if (invalidCustomers.length > 0) {
          alert('Algunos clientes no tienen los campos requeridos completos. Por favor revisa el archivo.');
          console.error('Clientes inválidos:', invalidCustomers);
          return;
        }

        // Insertar clientes
        const { error: insertError, data: insertedData } = await supabase
          .from('customers')
          .insert(customers)
          .select();

        if (insertError) {
          throw insertError;
        }

        alert(`${insertedData.length} clientes importados exitosamente`);
        loadCustomers();
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error al importar clientes:', error);
      alert('Error al importar clientes. Por favor revisa la consola para más detalles.');
    }

    // Limpiar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Función para manejar el ordenamiento
  const handleSort = (key: keyof Customer | 'address') => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    
    setSortConfig({ key, direction });
    
    const sorted = [...filteredCustomers].sort((a, b) => {
      let aValue: string;
      let bValue: string;
      
      if (key === 'address') {
        aValue = `${a.street} ${a.number}, ${a.district}, ${a.city}`.toLowerCase();
        bValue = `${b.street} ${b.number}, ${b.district}, ${b.city}`.toLowerCase();
      } else {
        aValue = (a[key] || '').toString().toLowerCase();
        bValue = (b[key] || '').toString().toLowerCase();
      }
      
      if (direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
    
    setFilteredCustomers(sorted);
  };

  // Componente para el encabezado de columna ordenable
  const SortableHeader = ({ label, field }: { label: string; field: keyof Customer | 'address' }) => {
    return (
      <th 
        scope="col" 
        className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-2">
          {label}
          {sortConfig?.key === field && (
            <span className="text-primary-500">
              {sortConfig.direction === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary-700"
          >
            <Plus className="h-5 w-5" />
            Nuevo Cliente
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-green-700"
          >
            <Upload className="h-5 w-5" />
            Importar Excel
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-800 shadow rounded-lg">
        <div className="p-4 border-b border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-surface-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, RUT o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border-none focus:ring-0 bg-transparent text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 dark:divide-surface-700">
            <thead className="bg-surface-50 dark:bg-surface-800">
              <tr>
                <SortableHeader label="Código" field="code" />
                <SortableHeader label="RUT" field="rut" />
                <SortableHeader label="Nombre" field="full_name" />
                <SortableHeader label="Tipo" field="type" />
                <SortableHeader label="Dirección" field="address" />
                <SortableHeader label="Comentarios" field="comments" />
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-900 divide-y divide-surface-200 dark:divide-surface-700">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{customer.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{customer.rut}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{customer.full_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {customer.type === 'personal' ? 'Particular' : 'Empresa'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {`${customer.street} ${customer.number}, ${customer.district}, ${customer.city}`}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {customer.comments || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Pencil className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-surface-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-800 rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-4">
              {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Código</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">RUT {formData.type === 'business' && <span className="text-red-500">*</span>}</label>
                  <input
                    type="text"
                    placeholder="12.345.678-9"
                    value={formData.rut}
                    onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                    className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                    required={formData.type === 'business'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Tipo de cliente</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'personal' | 'business' })}
                  className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                >
                  <option value="personal">Particular</option>
                  <option value="business">Empresa</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Calle</label>
                  <input
                    type="text"
                    required
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Número</label>
                  <input
                    type="text"
                    required
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Comuna</label>
                  <input
                    type="text"
                    required
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Ciudad</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Referencia</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Contacto</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                  placeholder="Persona de contacto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-surface-100">Comentarios</label>
                <textarea
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  className="mt-1 block w-full rounded-md border-surface-300 dark:border-surface-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-surface-700 dark:text-white"
                  placeholder="Agregar comentarios sobre el cliente"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-surface-900 dark:text-white bg-white dark:bg-surface-700 border border-surface-300 dark:border-surface-600 rounded-md hover:bg-surface-50 dark:hover:bg-surface-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700"
                >
                  {editingCustomer ? 'Guardar cambios' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}