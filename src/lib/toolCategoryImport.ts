import { canonicalCategory, canonicalSubcategory, classifyTool, normalizeToolText, serializeClassification, type TaxonomyTool, type ToolCategory } from './toolTaxonomy';

export interface ImportTool extends TaxonomyTool { id: string; code: string; name: string }
export interface CategoryImportRow {
  row: number;
  code: string;
  name: string;
  toolId: string;
  originalCategory: string | null;
  currentCategory: string;
  newCategory: string;
  changed: boolean;
}
export interface CategoryImportPlan { rows: CategoryImportRow[]; errors: string[] }

export function planCategoryImport(input: Record<string, unknown>[], tools: readonly ImportTool[], catalog: readonly ToolCategory[]): CategoryImportPlan {
  const errors: string[] = [];
  const rows: CategoryImportRow[] = [];
  const byCode = new Map<string, ImportTool[]>();
  const seen = new Set<string>();
  tools.forEach(tool => { const key = tool.code.trim().toUpperCase(); byCode.set(key, [...(byCode.get(key) || []), tool]); });
  input.forEach((row, index) => {
    const number = index + 2;
    const fields = new Map(Object.entries(row).map(([key,value]) => [normalizeToolText(key), String(value ?? '').trim()]));
    const code = (fields.get('codigo') || fields.get('code') || '').toUpperCase();
    if (!code) { errors.push('Fila ' + number + ': falta el código.'); return; }
    if (seen.has(code)) { errors.push('Fila ' + number + ': código duplicado ' + code + '.'); return; }
    seen.add(code);
    const matches = byCode.get(code);
    if (!matches?.length) { errors.push('Fila ' + number + ': no existe el código ' + code + '.'); return; }
    if (matches.length !== 1) { errors.push('Fila ' + number + ': el código ' + code + ' identifica más de una herramienta.'); return; }
    const tool = matches[0];
    const current = classifyTool(tool);
    let next = current;
    if (fields.has('categoria principal') || fields.has('subcategoria')) {
      const category = fields.get('categoria principal') || '';
      const subcategory = fields.get('subcategoria') || '';
      if (!category || !subcategory) { errors.push('Fila ' + number + ': completá categoría principal y subcategoría.'); return; }
      next = { category: canonicalCategory(category), subcategory: canonicalSubcategory(canonicalCategory(category), subcategory) };
    } else {
      const legacy = fields.get('nueva categoria');
      if (legacy === undefined) { errors.push('Fila ' + number + ': faltan las columnas de categoría y subcategoría.'); return; }
      if (!legacy) { errors.push('Fila ' + number + ': la nueva categoría está vacía.'); return; }
      if (normalizeToolText(legacy) !== normalizeToolText(tool.category || 'Otros')) {
        next = classifyTool({ ...tool, category: legacy });
      }
    }
    const parent = catalog.find(c => normalizeToolText(c.name) === normalizeToolText(next.category));
    const sub = parent?.subcategories.find(s => normalizeToolText(s) === normalizeToolText(next.subcategory));
    if (!parent || !sub) {
      errors.push('Fila ' + number + ': ' + next.category + ' / ' + next.subcategory + ' no pertenece al catálogo. Registrá primero esa subcategoría.');
      return;
    }
    const newCategory = serializeClassification({ category: parent.name, subcategory: sub });
    const currentCategory = serializeClassification(current);
    rows.push({ row: number, code: tool.code, name: tool.name, toolId: tool.id, originalCategory: tool.category ?? null, currentCategory, newCategory, changed: newCategory !== currentCategory });
  });
  return { rows, errors };
}
