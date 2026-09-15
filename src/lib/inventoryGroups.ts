import { classifyTool, type TaxonomyTool } from './toolTaxonomy';

/** Browsing groups combine units without changing their saved classification. */
export function inventoryGroup(tool: TaxonomyTool): { key: string; label: string; category: string } {
  const { category, subcategory } = classifyTool(tool);
  if (category !== 'Amoladora') return { key: category, label: category, category };
  if (subcategory === '7 pulgadas') return { key: 'Amoladora:7', label: 'Amoladora 7 pulgadas', category };
  return { key: 'Amoladora:otras', label: 'Otras amoladoras', category };
}
