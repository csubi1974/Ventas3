import React from 'react';
import { Bell, User, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export function TopBar() {
  const { signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="bg-white dark:bg-surface-900 shadow-sm border-b border-surface-200 dark:border-surface-700">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex items-center gap-4">
            <img 
              src="/logo.png"
              alt="Agua Purificada Amanzzi"
              className="h-12 w-12 object-contain"
            />
            <h1 className="text-2xl font-semibold text-surface-900 dark:text-white">
              Agua Purificada Amanzzi
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-surface-400 hover:text-primary-500 dark:text-surface-400 dark:hover:text-primary-400 transition-colors"
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {isDark ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </button>

            <button className="p-2 text-surface-400 hover:text-primary-500 dark:text-surface-400 dark:hover:text-primary-400 transition-colors">
              <Bell className="h-6 w-6" />
            </button>
            
            <div className="relative">
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 p-2 text-surface-400 hover:text-primary-500 dark:text-surface-400 dark:hover:text-primary-400 transition-colors"
              >
                <User className="h-6 w-6" />
                <span className="dark:text-white">Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}