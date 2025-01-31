import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  ShoppingCart,
  Truck,
  Package,
  DollarSign,
  BarChart,
  Users as UsersIcon,
  Settings,
  Box,
  Smartphone
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', icon: Home, href: '/' },
  { name: 'Clientes', icon: Users, href: '/customers' },
  { name: 'Ventas', icon: ShoppingCart, href: '/sales' },
  { name: 'Ventas Móviles', icon: Smartphone, href: '/mobile-sales' },
  { name: 'Rutas', icon: Truck, href: '/routes' },
  { name: 'Inventario', icon: Package, href: '/inventory' },
  { name: 'Productos', icon: Box, href: '/products' },
  { name: 'Finanzas', icon: DollarSign, href: '/finances' },
  { name: 'Usuarios', icon: UsersIcon, href: '/users' },
  { name: 'Reportes', icon: BarChart, href: '/reports' },
  { name: 'Configuración', icon: Settings, href: '/settings' },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex w-64 flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-r border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <img
                className="h-8 w-auto"
                src="https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&q=80&w=100"
                alt="Logo"
              />
            </div>
            <nav className="mt-5 flex-1 space-y-1 px-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      group flex items-center px-2 py-2 text-sm font-medium rounded-md
                      ${isActive
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-100'
                        : 'text-surface-600 hover:bg-surface-50 hover:text-primary-600 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-primary-400'}
                    `}
                  >
                    <Icon
                      className={`
                        mr-3 h-6 w-6 flex-shrink-0
                        ${isActive 
                          ? 'text-primary-500 dark:text-primary-400' 
                          : 'text-surface-400 group-hover:text-primary-500 dark:text-surface-500 dark:group-hover:text-primary-400'}
                      `}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}