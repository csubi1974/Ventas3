import { createClient } from '@supabase/supabase-js';

// Verificar que las variables de entorno estén definidas
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Las variables de entorno de Supabase no están configuradas correctamente');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Función auxiliar para manejar errores de Supabase
export const handleSupabaseError = (error: any) => {
  console.error('Error de Supabase:', error);
  
  if (error.message) {
    return `Error: ${error.message}`;
  }
  
  if (error.error_description) {
    return `Error: ${error.error_description}`;
  }
  
  return 'Ha ocurrido un error inesperado';
};