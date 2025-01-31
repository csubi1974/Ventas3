import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface Setting {
  id: string;
  key: string;
  value: any;
  description: string;
  category: string;
}

export function Settings() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
      checkAdminStatus();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error al verificar el estado de administrador:', error);
        return;
      }

      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error al verificar el estado de administrador:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('category');

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error al cargar la configuración:', error);
      setError('Error al cargar la configuración');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = (settingId: string, newValue: any) => {
    setSettings(settings.map(setting =>
      setting.id === settingId
        ? { ...setting, value: newValue }
        : setting
    ));
  };

  const handleSave = async (setting: Setting) => {
    try {
      const { error } = await supabase
        .from('settings')
        .update({ value: setting.value })
        .eq('id', setting.id);

      if (error) throw error;
      alert('Configuración guardada exitosamente');
    } catch (error) {
      console.error('Error al guardar la configuración:', error);
      alert('Error al guardar la configuración');
    }
  };

  const getCategoryName = (category: string) => {
    const categories: { [key: string]: string } = {
      'general': 'General',
      'financial': 'Facturación',
      'inventory': 'Inventario',
      'operations': 'Operaciones',
      'system': 'Sistema'
    };
    return categories[category] || category;
  };

  const getKeyName = (key: string) => {
    const keys: { [key: string]: string } = {
      'company': 'Información de la Empresa',
      'billing': 'Facturación',
      'inventory': 'Inventario',
      'delivery': 'Entregas',
      'notifications': 'Notificaciones'
    };
    return keys[key] || key;
  };

  const getFieldName = (field: string) => {
    const fields: { [key: string]: string } = {
      'name': 'Nombre',
      'rut': 'RUT',
      'address': 'Dirección',
      'phone': 'Teléfono',
      'email': 'Correo electrónico',
      'tax_rate': 'Tasa de impuesto',
      'currency': 'Moneda',
      'payment_methods': 'Métodos de pago',
      'low_stock_threshold': 'Umbral de stock bajo',
      'critical_stock_threshold': 'Umbral de stock crítico',
      'default_location': 'Ubicación predeterminada',
      'start_time': 'Hora de inicio',
      'end_time': 'Hora de término',
      'max_daily_routes': 'Máximo de rutas diarias',
      'max_stops_per_route': 'Máximo de paradas por ruta',
      'low_stock_alerts': 'Alertas de stock bajo',
      'payment_reminders': 'Recordatorios de pago',
      'delivery_notifications': 'Notificaciones de entrega'
    };
    return fields[field] || field.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const renderSettingInput = (setting: Setting) => {
    const value = setting.value;

    if (typeof value === 'boolean') {
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleSettingChange(setting.id, e.target.checked)}
            disabled={!isAdmin}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-surface-300 rounded"
          />
        </div>
      );
    }

    if (typeof value === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleSettingChange(setting.id, parseFloat(e.target.value))}
          disabled={!isAdmin}
          className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-surface-800 text-surface-900 dark:text-white"
        />
      );
    }

    if (Array.isArray(value)) {
      return (
        <input
          type="text"
          value={value.join(', ')}
          onChange={(e) => handleSettingChange(setting.id, e.target.value.split(',').map(v => v.trim()))}
          disabled={!isAdmin}
          className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-surface-800 text-surface-900 dark:text-white"
        />
      );
    }

    if (typeof value === 'object') {
      return Object.entries(value).map(([key, val]) => (
        <div key={key} className="mb-4">
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
            {getFieldName(key)}
          </label>
          <input
            type={typeof val === 'number' ? 'number' : 'text'}
            value={val as string}
            onChange={(e) => {
              const newValue = { ...value, [key]: e.target.value };
              handleSettingChange(setting.id, newValue);
            }}
            disabled={!isAdmin}
            className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-surface-800 text-surface-900 dark:text-white"
          />
        </div>
      ));
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleSettingChange(setting.id, e.target.value)}
        disabled={!isAdmin}
        className="mt-1 block w-full rounded-md border-surface-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-surface-800 text-surface-900 dark:text-white"
      />
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full text-red-600">
        <AlertTriangle className="h-6 w-6 mr-2" />
        {error}
      </div>
    );
  }

  const categories = Array.from(new Set(settings.map(s => s.category)));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-white">Configuración</h1>
        {!isAdmin && (
          <div className="text-yellow-600 dark:text-yellow-500 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Solo los administradores pueden modificar la configuración
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-surface-900 shadow rounded-lg">
        <div className="border-b border-surface-200 dark:border-surface-700">
          <nav className="-mb-px flex">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className={`py-4 px-6 text-sm font-medium ${
                  activeTab === category
                    ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300'
                }`}
              >
                {getCategoryName(category)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {settings
            .filter(setting => setting.category === activeTab)
            .map(setting => (
              <div key={setting.id} className="mb-8 last:mb-0">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-surface-900 dark:text-white">
                      {getKeyName(setting.key)}
                    </h3>
                    {setting.description && (
                      <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">{setting.description}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleSave(setting)}
                      className="ml-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-surface-900"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Guardar
                    </button>
                  )}
                </div>
                {renderSettingInput(setting)}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}