import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const DEFAULT_CATEGORIES = [
  'Amoladoras',
  'Taladros / Rotomartillos',
  'Escaleras',
  'Medición y Prueba',
  'Generadores y Motores',
  'Herramientas de Mano',
  'Seguridad y Protección',
  'Prensas y Pinzas',
  'Vehículos',
  'Insumos y Consumibles',
  'Rotuladora',
  'Otros'
];

export function useCategories() {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      // Ambas fuentes son independientes; no esperar una para pedir la otra.
      const [{ data: dbCatData }, { data: toolCatData }] = await Promise.all([
        supabase.from('categorias_herramientas').select('name').order('name'),
        supabase.from('herramientas').select('category'),
      ]);

      const set = new Set<string>();

      if (dbCatData && dbCatData.length > 0) {
        dbCatData.forEach(c => {
          if (c.name && c.name.trim()) set.add(c.name.trim());
        });
      }

      if (toolCatData && toolCatData.length > 0) {
        toolCatData.forEach(t => {
          if (t.category && t.category.trim()) set.add(t.category.trim());
        });
      }

      // Si no hay ninguna en DB, usar las por defecto
      if (set.size === 0) {
        DEFAULT_CATEGORIES.forEach(c => set.add(c));
      }

      // Disponible también antes de registrar la primera rotuladora.
      set.add('Rotuladora');

      setCategories(Array.from(set).sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.warn('Error al cargar categorías dinámicas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, loading, refreshCategories: fetchCategories };
}
