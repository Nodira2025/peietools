export interface TaxonomyTool {
  name?: string | null;
  category?: string | null;
  model?: string | null;
  brand?: string | null;
  code?: string | null;
}

export interface ToolClassification { category: string; subcategory: string }
export interface ToolCategory { name: string; subcategories: string[] }

// A qualified name fits the existing text columns in herramientas and the category
// registry. This keeps old clients/data readable without requiring a schema rollout.
export const CATEGORY_SEPARATOR = ' › ';
export const STANDARD_CATALOG: Record<string, readonly string[]> = {
  'Amoladora': ['4 1/2 pulgadas', '7 pulgadas', '9 pulgadas', 'Diámetro por confirmar'],
  'Andamio': ['Cuerpo', 'Tablón', 'Rueda', 'Tipo por confirmar'],
  'Arnés': ['Completo', 'Tipo por confirmar'],
  'Cable': ['Tipo y sección por confirmar'],
  'Cajón de herramientas': ['Metálico', 'Material por confirmar'],
  'Chocla': ['Sin variante registrada'],
  'Cortacables': ['A criquet', 'Tipo por confirmar'],
  'Escalera': ['2 peldaños', '3 peldaños', '4 peldaños', '5 peldaños', '6 peldaños', '7 peldaños', '8 peldaños', '9 peldaños', '10 peldaños', '11 peldaños', '12 peldaños', 'Extensible', 'Peldaños por confirmar'],
  'Escoba': ['De obra', 'Tipo por confirmar'],
  'Garrafa': ['2 kg', '3 kg', 'Capacidad por confirmar'],
  'Mecha': ['Copa', 'Pala', 'Tipo por confirmar'],
  'Pala': ['De punta', 'Tipo por confirmar'],
  'Pinza de indentar': ['16–120 mm²', 'Capacidad por confirmar'],
  'Pistola de calor': ['2000 W', 'Potencia por confirmar'],
  'Resorte': ['20 mm', '22 mm', '25 mm', 'Diámetro por confirmar'],
  'Rotomartillo': ['SDS Plus', 'Demoledor', 'Percutor', 'Tipo por confirmar'],
  'Rotuladora': ['Sin variante registrada'],
  'Soldador': ['De estaño · 60 W', 'De estaño', 'Tipo por confirmar'],
  'Sunchadora': ['Sin variante registrada'],
  'Taladro': ['Percutor', 'Inalámbrico', 'Tipo por confirmar'],
  'Tijera': ['De aviación', 'Pelacables', 'Tipo por confirmar'],
  'Vaselina': ['Sólida', 'Tipo por confirmar'],
  'Por clasificar': ['Tipo por confirmar', 'Retro · confirmar herramienta'],
};

const tidy = (value: string) => value.trim().replace(/\s+/g, ' ');
export const normalizeToolText = (value: string) => tidy(value)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[–—]/g, '-')
  .replace(/\bidentar\b/g, 'indentar').replace(/\b(\d+)\s*p\b/g, '$1 peldanos');

const legacyAliases: Record<string, string> = {
  escaleras: 'Escalera', amoladoras: 'Amoladora', taladros: 'Taladro',
  'rotomartillos': 'Rotomartillo', 'roto-martillos': 'Rotomartillo',
  'pinza de identar': 'Pinza de indentar', 'pinzas de indentar': 'Pinza de indentar',
  'tijera cortacables': 'Tijera', 'tijera corta cable': 'Tijera',
  'herramientas de mano': 'Herramienta manual',
  'elementos de seguridad': 'Seguridad y protección', 'seguridad y proteccion': 'Seguridad y protección',
  'medicion y prueba': 'Medición y prueba', 'instrumentos de medicion': 'Medición y prueba',
  'insumos y consumibles': 'Insumo y consumible', vehiculos: 'Vehículo',
  'generadores y motores': 'Generador y motor', 'prensas y pinzas': 'Prensa y pinza',
  otros: 'Por clasificar', retro: 'Por clasificar',
  'taladros / rotomartillos': 'Por clasificar',
};
const broadLegacy = new Set(['otros', 'escaleras', 'taladros / rotomartillos', 'herramientas de mano', 'elementos de seguridad', 'seguridad y proteccion', 'prensas y pinzas', 'insumos y consumibles', 'tijera cortacables', 'retro']);

export function canonicalCategory(value: string): string {
  const text = tidy(value);
  const key = normalizeToolText(text);
  const standard = Object.keys(STANDARD_CATALOG).find(c => normalizeToolText(c) === key);
  if (standard) return standard;
  if (legacyAliases[key]) return legacyAliases[key];
  if (/^escalera\b/.test(key)) return 'Escalera';
  if (/^amoladora\b/.test(key)) return 'Amoladora';
  if (/^rotomartillo\b/.test(key)) return 'Rotomartillo';
  return text ? text[0].toLocaleUpperCase('es') + text.slice(1).toLocaleLowerCase('es') : 'Por clasificar';
}

export function defaultSubcategory(category: string): string {
  const variants = STANDARD_CATALOG[category];
  return variants?.find(s => s.endsWith('por confirmar')) || variants?.find(s => s === 'Sin variante registrada') || 'Tipo por confirmar';
}

export function canonicalSubcategory(category: string, value: string): string {
  const text = tidy(value);
  const key = normalizeToolText(text);
  if (!text) return defaultSubcategory(category);
  if (category === 'Escalera') {
    const steps = key.match(/^(?:de\s+)?(\d{1,2})\s*(?:peldanos?|pel|peld\.?)$/);
    if (steps) return `${Number(steps[1])} peldaños`;
  }
  const standard = STANDARD_CATALOG[category]?.find(s => normalizeToolText(s) === key);
  return standard || text[0].toLocaleUpperCase('es') + text.slice(1);
}

export function parseCategoryPath(value: string | null | undefined): ToolClassification | null {
  if (!value?.includes('›')) return null;
  const [main, ...rest] = value.split('›');
  const category = canonicalCategory(main);
  return { category, subcategory: canonicalSubcategory(category, rest.join(' ').trim()) };
}

export function serializeClassification(value: ToolClassification): string {
  const category = canonicalCategory(value.category);
  return `${category}${CATEGORY_SEPARATOR}${canonicalSubcategory(category, value.subcategory)}`;
}

function familyFromName(name: string): string | null {
  if (/\bescalera\b/.test(name)) return 'Escalera';
  if (/\bamoladora\b/.test(name)) return 'Amoladora';
  if (/rotomartillo|roto.?martillo|retro.*sds/.test(name)) return 'Rotomartillo';
  if (/\btaladro\b/.test(name)) return 'Taladro';
  if (/\bandamio\b/.test(name)) return 'Andamio';
  if (/\bindentar\b|\bcrimpeadora\b|prensa terminal/.test(name)) return 'Pinza de indentar';
  if (/corta.?cables|pela.?cables/.test(name) && /criquet|cricket/.test(name)) return 'Cortacables';
  if (/\btijera\b/.test(name)) return 'Tijera';
  if (/\bcajon\b/.test(name)) return 'Cajón de herramientas';
  if (/\barnes\b/.test(name)) return 'Arnés';
  if (/\bgarrafa\b/.test(name)) return 'Garrafa';
  if (/\bmecha\b/.test(name)) return 'Mecha';
  if (/pistola.*(?:calor|termica)/.test(name)) return 'Pistola de calor';
  if (/\bresorte\b/.test(name)) return 'Resorte';
  if (/\bvaselina\b/.test(name)) return 'Vaselina';
  if (/\bsoldador\b/.test(name)) return 'Soldador';
  if (/\bpala\b/.test(name)) return 'Pala';
  if (/\bescoba\b/.test(name)) return 'Escoba';
  if (/\bcable\b/.test(name)) return 'Cable';
  if (/\brotuladora\b/.test(name)) return 'Rotuladora';
  if (/\bsunchadora\b/.test(name)) return 'Sunchadora';
  if (/\bchocla\b/.test(name)) return 'Chocla';
  return null;
}

export function classifyTool(tool: TaxonomyTool): ToolClassification {
  // Explicit saved choices take precedence over legacy inference, including an
  // intentional "Por clasificar". Never rewrite a user's chosen family from a name.
  const explicit = parseCategoryPath(tool.category);
  if (explicit) return explicit;
  const name = normalizeToolText(tool.name || '');
  const raw = normalizeToolText(tool.category || '');
  const category = (!raw || broadLegacy.has(raw) ? familyFromName(name) : null)
    || canonicalCategory(tool.category || familyFromName(name) || 'Por clasificar');
  const text = normalizeToolText(`${tool.name || ''} ${tool.category || ''} ${tool.model || ''}`);
  let subcategory = defaultSubcategory(category);
  if (category === 'Escalera') {
    const matches = [...text.matchAll(/\b(\d{1,2})\s*(?:peldanos?|pel\b|peld\b)/g)];
    const counts = [...new Set(matches.map(m => Number(m[1])))];
    if (counts.length === 1 && counts[0] > 0) subcategory = `${counts[0]} peldaños`;
    else if (counts.length === 0 && /extensible/.test(text)) subcategory = 'Extensible';
  } else if (category === 'Amoladora') {
    // Unit-bearing measurements only: 750 W and model numbers are not diameters.
    const dimensions: string[] = [];
    if (/\b4\s*(?:1\s*\/\s*2|[.,]5)\s*(?:"|″|pulg)|\b115\s*mm\b/.test(text)) dimensions.push('4 1/2 pulgadas');
    if (/\b7\s*(?:"|″|pulg)|\b180\s*mm\b/.test(text)) dimensions.push('7 pulgadas');
    if (/\b9\s*(?:"|″|pulg)|\b230\s*mm\b/.test(text)) dimensions.push('9 pulgadas');
    if (dimensions.length === 1) subcategory = dimensions[0];
  } else if (category === 'Rotomartillo') {
    if (/sds[ -]*plus/.test(text)) subcategory = 'SDS Plus';
    else if (/demoledor/.test(text)) subcategory = 'Demoledor';
    else if (/percutor/.test(text)) subcategory = 'Percutor';
  } else if (category === 'Taladro') {
    if (/inalambrico/.test(text)) subcategory = 'Inalámbrico';
    else if (/percutor/.test(text)) subcategory = 'Percutor';
  } else if (category === 'Cajón de herramientas' && /metalic/.test(text)) subcategory = 'Metálico';
  else if (category === 'Andamio') subcategory = /tablon/.test(text) ? 'Tablón' : /rueda|garrucha/.test(text) ? 'Rueda' : /cuerpo/.test(text) ? 'Cuerpo' : subcategory;
  else if (category === 'Arnés' && /completo/.test(text)) subcategory = 'Completo';
  else if (category === 'Garrafa') { const kg = text.match(/\b(\d+(?:[.,]\d+)?)\s*kg\b/); if (kg) subcategory = `${kg[1].replace('.', ',')} kg`; }
  else if (category === 'Pinza de indentar') { const cap = text.match(/\b(\d+)\s*[-–]\s*(\d+)\s*mm[²2]/); if (cap) subcategory = `${cap[1]}–${cap[2]} mm²`; }
  else if (category === 'Cortacables' && /criquet|cricket/.test(text)) subcategory = 'A criquet';
  else if (category === 'Tijera') subcategory = /aviacion|hojalater/.test(text) ? 'De aviación' : /pela.?cables/.test(text) ? 'Pelacables' : subcategory;
  else if (category === 'Mecha') subcategory = /copa/.test(text) ? 'Copa' : /pala/.test(text) ? 'Pala' : subcategory;
  else if (category === 'Pistola de calor') { const watts = text.match(/\b(\d+)\s*w\b/); if (watts) subcategory = `${watts[1]} W`; }
  else if (category === 'Resorte') { const mm = text.match(/\b(\d+(?:[.,]\d+)?)\s*mm\b/); if (mm) subcategory = `${mm[1].replace('.', ',')} mm`; }
  else if (category === 'Vaselina' && /solida/.test(text)) subcategory = 'Sólida';
  else if (category === 'Soldador' && /estano/.test(text)) subcategory = /\b60\s*w\b/.test(text) ? 'De estaño · 60 W' : 'De estaño';
  else if (category === 'Pala' && /punta/.test(text)) subcategory = 'De punta';
  else if (category === 'Escoba' && /obra/.test(text)) subcategory = 'De obra';
  else if (category === 'Por clasificar' && /\bretro\b/.test(text)) subcategory = 'Retro · confirmar herramienta';
  return { category, subcategory };
}

export const compareCategories = (a: string, b: string) => Number(a === 'Por clasificar') - Number(b === 'Por clasificar') || a.localeCompare(b, 'es', { numeric: true });
export const compareSubcategories = (a: string, b: string) => Number(/confirmar|Sin variante/.test(a)) - Number(/confirmar|Sin variante/.test(b)) || a.localeCompare(b, 'es', { numeric: true });

export function buildToolCatalog(tools: readonly TaxonomyTool[], registeredNames: readonly string[] = []): ToolCategory[] {
  const categories = new Map<string, Map<string, string>>();
  const add = ({ category, subcategory }: ToolClassification) => {
    if (!categories.has(category)) categories.set(category, new Map());
    categories.get(category)!.set(normalizeToolText(subcategory), subcategory);
  };
  Object.entries(STANDARD_CATALOG).forEach(([category, subs]) => subs.forEach(subcategory => add({ category, subcategory })));
  registeredNames.forEach(name => add(classifyTool({ category: name })));
  tools.forEach(tool => add(classifyTool(tool)));
  return [...categories.entries()].map(([name, subs]) => ({ name, subcategories: [...subs.values()].sort(compareSubcategories) })).sort((a,b) => compareCategories(a.name,b.name));
}

export function toolSearchText(tool: TaxonomyTool): string {
  const classification = classifyTool(tool);
  return normalizeToolText([tool.name, tool.code, tool.brand, tool.model, tool.category, classification.category, classification.subcategory].filter(Boolean).join(' '));
}

export function matchesToolSearch(tool: TaxonomyTool, query: string): boolean {
  const singular: Record<string, string> = { escaleras: 'escalera', amoladoras: 'amoladora', taladros: 'taladro', rotomartillos: 'rotomartillo', pinzas: 'pinza', tijeras: 'tijera' };
  const expandInches = (text: string) => text.replace(/\b(\d+(?:[.,]\d+)?(?:\s+1\/2)?)\s*["″]/g, '$1 pulgadas');
  const normalized = expandInches(normalizeToolText(query));
  const tokens = normalized.replace(/[›"″]/g, ' ').split(/\s+/).filter(token => token && token !== 'de').map(token => singular[token] || token);
  const haystack = expandInches(toolSearchText(tool));
  const steps = normalized.match(/\b(\d+)\s*peldanos?\b/);
  if (steps && !new RegExp('\\b' + steps[1] + '\\s*peldanos?\\b').test(haystack)) return false;
  const measurements = (text: string) => [...text.matchAll(/\b(\d+(?:[.,]\d+)?(?:\s+1\/2)?)\s*(pulgadas?|mm(?:²|2)?|kg|w)(?=$|[\s),])/g)]
    .map(match => match[1].replace(',', '.') + '|' + match[2].replace(/^pulgada$/, 'pulgadas').replace('mm2', 'mm²'));
  const availableMeasurements = new Set(measurements(haystack));
  if (measurements(normalized).some(value => !availableMeasurements.has(value))) return false;
  return tokens.every(token => haystack.includes(token));
}
