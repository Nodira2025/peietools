/**
 * Motor Inteligente de Normalización de Texto de Órdenes de Compra (WhatsApp -> BD)
 * Limpia lenguaje informal, errores de tipeo comunes en obras/construcción,
 * extrae cantidades y genera un listado pulido y estructurado.
 */

export interface FormattedItem {
  quantity: number;
  item: string;
  specs?: string;
}

export interface AIPurchaseResult {
  formattedTitle: string;
  formattedDescription: string;
  detectedPriority: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
  extractedItems: FormattedItem[];
}

// Diccionario de corrección de palabras/errores comunes de obra
const TYPO_MAP: Record<string, string> = {
  'amoladra': 'Amoladora',
  'amoladores': 'Amoladoras',
  'amolador': 'Amoladora',
  'disos': 'Discos',
  'dico': 'Disco',
  'dicos': 'Discos',
  'rotomartilo': 'Rotomartillo',
  'rotomartio': 'Rotomartillo',
  'guante': 'Guantes',
  'guantes': 'Guantes',
  'baquta': 'baqueta',
  'vaqueta': 'baqueta',
  'hormigon': 'Hormigón',
  'ormigon': 'Hormigón',
  'clavos': 'Clavos',
  'clavo': 'Clavos',
  'tirafondo': 'Tirafondos',
  'extencon': 'Extensión eléctrica',
  'extencion': 'Extensión eléctrica',
  'alambre': 'Alambre recocido',
  'electrodos': 'Electrodos',
  'eletrodos': 'Electrodos',
  'taladro': 'Taladro',
  'mecha': 'Mecha',
  'mechas': 'Mechas',
  'soga': 'Soga de seguridad',
  'arnes': 'Arnés de seguridad',
  'casco': 'Casco de protección',
  'cascos': 'Cascos de protección',
};

export function normalizeWhatsAppPurchaseText(rawText: string): AIPurchaseResult {
  if (!rawText || !rawText.trim()) {
    return {
      formattedTitle: 'Orden de Compra',
      formattedDescription: 'Sin especificaciones',
      detectedPriority: 'Normal',
      extractedItems: []
    };
  }

  const cleanText = rawText.trim();
  const lowerText = cleanText.toLowerCase();

  // Detectar prioridad por palabras clave de urgencia
  let detectedPriority: 'Baja' | 'Normal' | 'Alta' | 'Urgente' = 'Normal';
  if (/urgente|ya mismo|ahora|asap|imprescindible|parada/i.test(lowerText)) {
    detectedPriority = 'Urgente';
  } else if (/mañana|hoy|rapido|rápido|importante/i.test(lowerText)) {
    detectedPriority = 'Alta';
  } else if (/tranquilo|semana|cuando se pueda/i.test(lowerText)) {
    detectedPriority = 'Baja';
  }

  // Separar líneas o comas
  const lines = cleanText
    .split(/\n+|,|;|\+|\by\b/gi)
    .map(l => l.trim())
    .filter(l => l.length > 1);

  const items: FormattedItem[] = [];

  for (let line of lines) {
    // Evitar líneas vacías o saludos habituales de WhatsApp
    if (/^(hola|buenas|che|santi|fede|porfa|por favor|necesito|hace falta|pedir|comprar|manda|traeme|saludos|gracias)/i.test(line) && line.split(' ').length < 4) {
      // Limpiar prefijo si viene en la misma oración
      line = line.replace(/^(hola|buenas|che|santi|fede|porfa|por favor|necesito|hace falta|pedir|comprar|manda|traeme)\s*/i, '').trim();
      if (!line) continue;
    }

    // Extraer cantidad si existe (ej: "2 discos", "x3 amoladoras", "5kg clavos")
    let quantity = 1;
    const qtyMatch = line.match(/^(\d+)\s*(unid|unidades|uds|u|x|kg|m|mts|paquetes|cajas)?\b/i) || line.match(/\b(\d+)\s*(unid|unidades|uds|u|x|kg|m|mts)\b/i);
    
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10) || 1;
      line = line.replace(qtyMatch[0], '').trim();
    }

    // Corregir palabras comunes de tipeo
    let formattedWords = line.split(' ').map(word => {
      const cleanWord = word.toLowerCase().replace(/[^\wáéíóúñ]/gi, '');
      if (TYPO_MAP[cleanWord]) {
        return TYPO_MAP[cleanWord];
      }
      return word;
    });

    let cleanItem = formattedWords.join(' ').replace(/^[-*•\s]+/, '').trim();
    
    // Capitalizar primera letra
    if (cleanItem.length > 0) {
      cleanItem = cleanItem.charAt(0).toUpperCase() + cleanItem.slice(1);
      items.push({
        quantity,
        item: cleanItem
      });
    }
  }

  // Si no se pudieron parsear ítems separados, usar todo el texto corregido
  if (items.length === 0) {
    let corrected = cleanText;
    Object.keys(TYPO_MAP).forEach(k => {
      const reg = new RegExp(`\\b${k}\\b`, 'gi');
      corrected = corrected.replace(reg, TYPO_MAP[k]);
    });
    items.push({ quantity: 1, item: corrected });
  }

  // Formatear Título Principal
  const firstItem = items[0];
  const formattedTitle = items.length > 1
    ? `${items.length} ítems de compra: ${firstItem.item} (${firstItem.quantity}u) y otros`
    : `${firstItem.item} (${firstItem.quantity}u)`;

  // Formatear Descripción con Viñetas Estructuradas
  const formattedDescription = items
    .map((it, idx) => `• [${it.quantity}u] ${it.item}`)
    .join('\n');

  return {
    formattedTitle,
    formattedDescription,
    detectedPriority,
    extractedItems: items
  };
}
