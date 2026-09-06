/**
 * Tool Price Reference & Repair Expense Management Service
 * 
 * Provides Mercado Libre Argentina benchmark reference prices for construction 
 * and electrical tools, custom purchase price management, and repair expense logs.
 */

export interface ToolRepairExpense {
  id: string;
  herramienta_id: string;
  fecha: string; // YYYY-MM-DD
  monto: number; // in ARS
  tipo: 'Reparación de Motor/Bobinado' | 'Cambio de Carbones/Cables' | 'Mantenimiento Preventivo' | 'Batería / Cargador' | 'Reparación Mecánica' | 'Calibración / Prueba' | 'Otro';
  taller: string; // Service center or workshop
  descripcion: string;
  comprobante?: string; // Invoice / receipt number
  estado: 'Completado' | 'En proceso' | 'Pendiente';
  creado_por?: string;
  created_at: string;
}

export interface ToolPriceInfo {
  referencePrice: number;
  priceRange: { min: number; max: number };
  marketConfidence: 'alta' | 'media' | 'estimada';
  source: string;
  customPrice: number | null;
  effectivePrice: number;
  isCustom: boolean;
  totalRepairs: number;
  totalInvestment: number;
}

const STORAGE_CUSTOM_PRICES = 'peie_herramientas_custom_prices';
const STORAGE_REPAIRS = 'peie_herramientas_reparaciones';

/**
 * Deterministic Mercado Libre Argentina market benchmark pricing engine.
 * Categorizes and prices tools based on name, brand, model, description, and specs.
 */
export function calculateReferencePrice(tool: {
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  description?: string | null;
}): { referencePrice: number; priceRange: { min: number; max: number }; marketConfidence: 'alta' | 'media' | 'estimada' } {
  const name = (tool.name || '').toLowerCase();
  const brand = (tool.brand || '').toLowerCase();
  const model = (tool.model || '').toLowerCase();
  const cat = (tool.category || '').toLowerCase();
  const text = `${name} ${brand} ${model} ${cat} ${tool.description || ''}`.toLowerCase();

  const isTier1Brand = brand.includes('dewalt') || brand.includes('bosch') || brand.includes('makita') || brand.includes('milwaukee') || brand.includes('hilti');
  const isTier2Brand = brand.includes('stanley') || brand.includes('total') || brand.includes('einhell') || brand.includes('lusqtoff') || brand.includes('lüsqtoff') || brand.includes('black');

  // 1. Grupo electrógeno / Generador
  if (text.includes('generador') || text.includes('electrogeno') || text.includes('electrógeno')) {
    const isBig = text.includes('6500') || text.includes('7000') || text.includes('8000') || text.includes('8500');
    if (isBig) return { referencePrice: 1150000, priceRange: { min: 950000, max: 1450000 }, marketConfidence: 'alta' };
    return { referencePrice: 780000, priceRange: { min: 620000, max: 980000 }, marketConfidence: 'alta' };
  }

  // 2. Rotomartillo / Demoledor
  if (text.includes('demoledor') || text.includes('rompedor')) {
    if (isTier1Brand) return { referencePrice: 520000, priceRange: { min: 420000, max: 680000 }, marketConfidence: 'alta' };
    return { referencePrice: 360000, priceRange: { min: 280000, max: 460000 }, marketConfidence: 'alta' };
  }
  if (text.includes('rotomartillo') || text.includes('roto martillo') || text.includes('electroneum') || text.includes('sds')) {
    const isSdsMax = text.includes('max') || text.includes('plus');
    if (isTier1Brand) {
      const price = isSdsMax ? 340000 : 280000;
      return { referencePrice: price, priceRange: { min: price * 0.85, max: price * 1.25 }, marketConfidence: 'alta' };
    }
    const price = isTier2Brand ? 185000 : 160000;
    return { referencePrice: price, priceRange: { min: 135000, max: 220000 }, marketConfidence: 'alta' };
  }

  // 3. Amoladoras
  if (text.includes('amoladora') || text.includes('radial') || text.includes('esmeril')) {
    const is9Inch = text.includes('9"') || text.includes('230mm') || text.includes('230 mm') || text.includes('9 pulgadas');
    const is7Inch = text.includes('7"') || text.includes('180mm') || text.includes('180 mm') || text.includes('7 pulgadas');

    if (is9Inch) {
      const base = isTier1Brand ? 295000 : 210000;
      return { referencePrice: base, priceRange: { min: base * 0.85, max: base * 1.2 }, marketConfidence: 'alta' };
    }
    if (is7Inch) {
      const base = isTier1Brand ? 230000 : 165000;
      return { referencePrice: base, priceRange: { min: base * 0.85, max: base * 1.2 }, marketConfidence: 'alta' };
    }
    // 4 1/2" (115mm)
    const base = isTier1Brand ? 105000 : isTier2Brand ? 75000 : 62000;
    return { referencePrice: base, priceRange: { min: base * 0.85, max: base * 1.2 }, marketConfidence: 'alta' };
  }

  // 4. Taladros / Atornilladores a batería
  if (text.includes('atornillador') || text.includes('impacto') || text.includes('bateria') || text.includes('batería') || text.includes('inalambrico') || text.includes('inalámbrico')) {
    const base = isTier1Brand ? 265000 : isTier2Brand ? 155000 : 120000;
    return { referencePrice: base, priceRange: { min: base * 0.85, max: base * 1.25 }, marketConfidence: 'alta' };
  }
  if (text.includes('taladro') || text.includes('percutor')) {
    const base = isTier1Brand ? 125000 : isTier2Brand ? 82000 : 65000;
    return { referencePrice: base, priceRange: { min: base * 0.85, max: base * 1.2 }, marketConfidence: 'alta' };
  }

  // 5. Soldadoras
  if (text.includes('soldadora') || text.includes('inverter') || text.includes('electrodo')) {
    const base = isTier1Brand ? 280000 : 175000;
    return { referencePrice: base, priceRange: { min: 140000, max: 240000 }, marketConfidence: 'alta' };
  }
  if (text.includes('mascara') || text.includes('máscara') || text.includes('fotosensible') || text.includes('careta')) {
    return { referencePrice: 48000, priceRange: { min: 35000, max: 68000 }, marketConfidence: 'alta' };
  }

  // 6. Escaleras dieléctricas / aluminio
  if (text.includes('escalera')) {
    const isDielectric = text.includes('dielectrica') || text.includes('dieléctrica') || text.includes('fibra');
    const isExtensible = text.includes('extensible') || text.includes('tramo') || text.includes('corrediza');
    if (isDielectric && isExtensible) {
      return { referencePrice: 580000, priceRange: { min: 450000, max: 790000 }, marketConfidence: 'alta' };
    }
    if (isDielectric) {
      return { referencePrice: 320000, priceRange: { min: 260000, max: 420000 }, marketConfidence: 'alta' };
    }
    if (isExtensible) {
      return { referencePrice: 280000, priceRange: { min: 220000, max: 360000 }, marketConfidence: 'alta' };
    }
    // Tijera o articulada
    return { referencePrice: 165000, priceRange: { min: 125000, max: 230000 }, marketConfidence: 'alta' };
  }

  // 7. Equipos de medición eléctrica
  if (text.includes('telurimetro') || text.includes('telurímetro') || text.includes('puesta a tierra')) {
    return { referencePrice: 340000, priceRange: { min: 260000, max: 480000 }, marketConfidence: 'alta' };
  }
  if (text.includes('megohmetro') || text.includes('megóhmetro') || text.includes('aislacion') || text.includes('aislación')) {
    return { referencePrice: 290000, priceRange: { min: 220000, max: 410000 }, marketConfidence: 'alta' };
  }
  if (text.includes('amperometrica') || text.includes('amperométrica') || text.includes('pinza')) {
    const base = isTier1Brand ? 145000 : 72000;
    return { referencePrice: base, priceRange: { min: base * 0.8, max: base * 1.3 }, marketConfidence: 'alta' };
  }
  if (text.includes('multimetro') || text.includes('multímetro') || text.includes('tester')) {
    return { referencePrice: 48000, priceRange: { min: 32000, max: 72000 }, marketConfidence: 'alta' };
  }
  if (text.includes('detector') || text.includes('buscapolo') || text.includes('tensión')) {
    return { referencePrice: 26000, priceRange: { min: 18000, max: 38000 }, marketConfidence: 'media' };
  }

  // 8. Ranuradora / Cortadora de pared / Caladora / Sierra
  if (text.includes('ranuradora') || text.includes('cortadora de pared') || text.includes('canalizadora')) {
    return { referencePrice: 340000, priceRange: { min: 270000, max: 450000 }, marketConfidence: 'alta' };
  }
  if (text.includes('circular') || text.includes('sierra') || text.includes('caladora') || text.includes('ingletadora')) {
    const base = isTier1Brand ? 210000 : 135000;
    return { referencePrice: base, priceRange: { min: base * 0.85, max: base * 1.25 }, marketConfidence: 'alta' };
  }

  // 9. Seguridad en altura
  if (text.includes('arnes') || text.includes('arnés') || text.includes('antacaidas') || text.includes('anticaidas')) {
    return { referencePrice: 92000, priceRange: { min: 70000, max: 135000 }, marketConfidence: 'alta' };
  }
  if (text.includes('linea de vida') || text.includes('línea de vida') || text.includes('retractil') || text.includes('retráctil')) {
    return { referencePrice: 220000, priceRange: { min: 170000, max: 310000 }, marketConfidence: 'alta' };
  }

  // 10. Termofusora / Pistola de calor
  if (text.includes('termofusora') || text.includes('termofusion') || text.includes('termofusión')) {
    return { referencePrice: 78000, priceRange: { min: 55000, max: 110000 }, marketConfidence: 'alta' };
  }
  if (text.includes('pistola de calor') || text.includes('decapador')) {
    return { referencePrice: 52000, priceRange: { min: 38000, max: 74000 }, marketConfidence: 'alta' };
  }

  // 11. Crimpadora / Prensa terminales / Cizalla
  if (text.includes('crimpadora') || text.includes('prensa terminal') || text.includes('crimp') || text.includes('hidraulica') || text.includes('hidráulica')) {
    return { referencePrice: 115000, priceRange: { min: 85000, max: 170000 }, marketConfidence: 'alta' };
  }

  // 12. Hormigonera / Compresor / Hidrolavadora
  if (text.includes('hormigonera')) {
    return { referencePrice: 380000, priceRange: { min: 310000, max: 480000 }, marketConfidence: 'alta' };
  }
  if (text.includes('compresor')) {
    return { referencePrice: 260000, priceRange: { min: 195000, max: 360000 }, marketConfidence: 'alta' };
  }
  if (text.includes('hidrolavadora')) {
    return { referencePrice: 240000, priceRange: { min: 180000, max: 340000 }, marketConfidence: 'alta' };
  }

  // 13. Pasacables / Prolongador / Tablero de obra
  if (text.includes('pasacable') || text.includes('cinta pasacable') || text.includes('fibra de vidrio')) {
    return { referencePrice: 65000, priceRange: { min: 45000, max: 95000 }, marketConfidence: 'media' };
  }
  if (text.includes('alargue') || text.includes('prolongador') || text.includes('rollo cable') || text.includes('carretel')) {
    return { referencePrice: 68000, priceRange: { min: 48000, max: 98000 }, marketConfidence: 'media' };
  }
  if (text.includes('tablero') || text.includes('torre')) {
    return { referencePrice: 180000, priceRange: { min: 130000, max: 260000 }, marketConfidence: 'media' };
  }

  // Fallback general estimado
  return { referencePrice: 85000, priceRange: { min: 55000, max: 130000 }, marketConfidence: 'estimada' };
}

/**
 * Retrieve all custom prices from localStorage
 */
function getAllCustomPrices(): Record<string, { price: number; updatedAt: string; updatedBy?: string; notes?: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_PRICES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Get custom price for a specific tool ID
 */
export function getToolCustomPrice(toolId: string): number | null {
  const all = getAllCustomPrices();
  return all[toolId]?.price ?? null;
}

/**
 * Save custom purchase price for a tool
 */
export function saveToolCustomPrice(toolId: string, price: number, updatedBy?: string, notes?: string): void {
  const all = getAllCustomPrices();
  all[toolId] = {
    price: Math.max(0, Math.round(price)),
    updatedAt: new Date().toISOString(),
    updatedBy,
    notes,
  };
  localStorage.setItem(STORAGE_CUSTOM_PRICES, JSON.stringify(all));
}

/**
 * Remove custom purchase price, reverting to benchmark reference
 */
export function removeToolCustomPrice(toolId: string): void {
  const all = getAllCustomPrices();
  delete all[toolId];
  localStorage.setItem(STORAGE_CUSTOM_PRICES, JSON.stringify(all));
}

/**
 * Retrieve all repair records from localStorage
 */
function getAllRepairs(): Record<string, ToolRepairExpense[]> {
  try {
    const raw = localStorage.getItem(STORAGE_REPAIRS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Get all repair expenses for a tool
 */
export function getToolRepairs(toolId: string): ToolRepairExpense[] {
  const all = getAllRepairs();
  return (all[toolId] || []).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

/**
 * Calculate total accumulated repair expenses for a tool
 */
export function getTotalRepairExpenses(toolId: string): number {
  const repairs = getToolRepairs(toolId);
  return repairs.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
}

/**
 * Add a new repair/maintenance expense record for a tool
 */
export function addToolRepair(
  expense: Omit<ToolRepairExpense, 'id' | 'created_at'>
): ToolRepairExpense {
  const all = getAllRepairs();
  const toolId = expense.herramienta_id;
  const list = all[toolId] || [];

  const newRecord: ToolRepairExpense = {
    ...expense,
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    monto: Math.max(0, Number(expense.monto) || 0),
    created_at: new Date().toISOString(),
  };

  list.unshift(newRecord);
  all[toolId] = list;
  localStorage.setItem(STORAGE_REPAIRS, JSON.stringify(all));
  return newRecord;
}

/**
 * Delete a repair expense record
 */
export function deleteToolRepair(toolId: string, repairId: string): void {
  const all = getAllRepairs();
  if (all[toolId]) {
    all[toolId] = all[toolId].filter((r) => r.id !== repairId);
    localStorage.setItem(STORAGE_REPAIRS, JSON.stringify(all));
  }
}

/**
 * Complete financial profile of a tool:
 * Market reference, custom purchase price, repairs, and total investment.
 */
export function getToolPriceInfo(tool: {
  id: string;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  description?: string | null;
}): ToolPriceInfo {
  const ref = calculateReferencePrice(tool);
  const custom = getToolCustomPrice(tool.id);
  const totalRepairs = getTotalRepairExpenses(tool.id);
  const effectivePrice = custom !== null ? custom : ref.referencePrice;

  return {
    referencePrice: ref.referencePrice,
    priceRange: ref.priceRange,
    marketConfidence: ref.marketConfidence,
    source: 'Mercado Libre Argentina (Benchmark Equipamiento)',
    customPrice: custom,
    effectivePrice,
    isCustom: custom !== null,
    totalRepairs,
    totalInvestment: effectivePrice + totalRepairs,
  };
}

/**
 * Formats a number as Argentine Pesos currency string (e.g. $ 185.000)
 */
export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}
