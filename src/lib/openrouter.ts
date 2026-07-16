export interface AnalyzedTool {
  nombre_sugerido: string;
  marca: string;
  modelo: string;
  categoria: string;
  descripcion_breve: string;
}

/**
 * Envía una imagen en base64 a la API de OpenRouter para reconocer la herramienta.
 */
export async function analyzeToolImage(base64Image: string): Promise<AnalyzedTool> {
  let apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    apiKey = localStorage.getItem('VITE_OPENROUTER_API_KEY') || '';
  }
  
  console.log('[OpenRouter] Iniciando análisis de imagen...');
  
  if (!apiKey) {
    console.error('[OpenRouter] Error: API Key no configurada en variables de entorno ni en localStorage.');
    throw new Error('CONFIG_REQUIRED');
  }

  // Extraer el base64 limpio y el tipo MIME
  const base64Data = base64Image.includes('base64,') 
    ? base64Image.split('base64,')[1] 
    : base64Image;

  let mimeType = 'image/jpeg';
  const mimeMatch = base64Image.match(/^data:([^;]+);/);
  if (mimeMatch) {
    mimeType = mimeMatch[1];
  }

  const prompt = `Analizá esta imagen de una herramienta de construcción u obra civil y devolvé un objeto JSON con las siguientes propiedades. No agregues markdown adicional ni etiquetas de código (como \`\`\`json), devolvé estrictamente el string JSON estructurado:
{
  "nombre_sugerido": "Nombre de la herramienta en español",
  "marca": "Marca identificada (ej: Bosch, DeWalt, Makita, Stanley, etc.)",
  "modelo": "Modelo específico si es visible",
  "categoria": "Categoría que mejor se adapte",
  "descripcion_breve": "Descripción técnica muy corta de sus características principales"
}

Categorías válidas: 'Escaleras', 'Amoladoras', 'Taladros', 'Elementos de seguridad', 'Instrumentos de medición', 'Vehículos', 'Otros'. Si no podés identificar una propiedad, dejala en blanco ("").`;

  console.log('[OpenRouter] Enviando petición a la API con el modelo google/gemini-2.5-flash...');
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://peietools.com',
        'X-Title': 'PEIE Tools'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[OpenRouter] La API devolvió error HTTP:', response.status, errorData);
      throw new Error(errorData.error?.message || `Error de API OpenRouter: ${response.status}`);
    }

    const data = await response.json();
    console.log('[OpenRouter] Respuesta recibida:', data);
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[OpenRouter] Respuesta vacía de choices:', data);
      throw new Error('No se recibió contenido de respuesta del modelo.');
    }

    console.log('[OpenRouter] Contenido crudo de la respuesta:', content);

    try {
      const parsed = JSON.parse(content.trim()) as AnalyzedTool;
      console.log('[OpenRouter] JSON parseado con éxito:', parsed);
      return parsed;
    } catch (err) {
      console.warn('[OpenRouter] Falló el parseo directo. Intentando limpiar markdown...');
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsedClean = JSON.parse(jsonMatch[0]) as AnalyzedTool;
          console.log('[OpenRouter] JSON parseado después de limpiar:', parsedClean);
          return parsedClean;
        } catch (e) {
          console.error('[OpenRouter] Falló también el parseo del bloque JSON limpio.');
          throw new Error('Error al parsear el JSON de la respuesta.');
        }
      }
      throw new Error('La respuesta de la IA no tiene un formato JSON válido.');
    }
  } catch (error: any) {
    console.error('[OpenRouter] Excepción capturada en fetch:', error);
    throw error;
  }
}

/**
 * Interpreta texto libre del usuario (dictado por voz, mal escrito, informal)
 * y devuelve términos de búsqueda estructurados para encontrar una herramienta.
 */
export async function interpretUserInput(userText: string): Promise<{ terminos: string[]; tipo_herramienta: string; descripcion: string }> {
  let apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    apiKey = localStorage.getItem('VITE_OPENROUTER_API_KEY') || '';
  }
  if (!apiKey) throw new Error('CONFIG_REQUIRED');

  const prompt = `Sos un asistente de logística en una obra de construcción. Un obrero te describe una herramienta de la forma más informal posible (puede tener errores ortográficos, usar jerga de obra, o describirla por su aspecto o uso). Tu trabajo es interpretar qué herramienta busca.

Texto del obrero: "${userText}"

Devolvé estrictamente un JSON (sin markdown) con:
{
  "terminos": ["lista", "de", "palabras", "clave", "para", "buscar"],
  "tipo_herramienta": "nombre correcto de la herramienta en español",
  "descripcion": "descripción clara de lo que el obrero quiere decir"
}

Ejemplos de interpretación:
- "el aparato azul para cortar fierro" → tipo: "amoladora" o "sierra sensitiva"
- "la maquinita que hace agujeros" → tipo: "taladro"
- "esa cosa amarilla para medir" → tipo: "nivel laser" o "cinta métrica"
- "el matafuego" → tipo: "matafuegos" o "extintor"`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://peietools.com',
        'X-Title': 'PEIE Tools'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Error API: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Respuesta vacía');

    try {
      return JSON.parse(content.trim());
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error('Respuesta sin formato JSON válido');
    }
  } catch (error: any) {
    console.error('[OpenRouter] Error en interpretUserInput:', error);
    throw error;
  }
}

export interface AnalyzedEmployee {
  nombre_sugerido: string;
  specialty: string;
  descripcion_breve: string;
}

/**
 * Envía una imagen de un operario a la API de OpenRouter para reconocerlo o identificar su especialidad/vestimenta.
 */
export async function analyzeEmployeeImage(base64Image: string): Promise<AnalyzedEmployee> {
  let apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    apiKey = localStorage.getItem('VITE_OPENROUTER_API_KEY') || '';
  }
  
  if (!apiKey) throw new Error('CONFIG_REQUIRED');

  const base64Data = base64Image.includes('base64,') 
    ? base64Image.split('base64,')[1] 
    : base64Image;

  let mimeType = 'image/jpeg';
  const mimeMatch = base64Image.match(/^data:([^;]+);/);
  if (mimeMatch) mimeType = mimeMatch[1];

  const prompt = `Analizá esta imagen de un operario u obrero en una obra de construcción y devolvé un objeto JSON con las siguientes propiedades. No agregues markdown adicional ni etiquetas de código (como \`\`\`json), devolvé estrictamente el string JSON estructurado:
{
  "nombre_sugerido": "Nombre de la persona si su casco/ropa tiene un nombre escrito, sino dejá vacío",
  "specialty": "Especialidad sugerida según su equipo/vestimenta (ej: Electricista, Soldador, Capataz, Albañil, Seguridad, Elementos de seguridad, Pintor, Plomero, etc.)",
  "descripcion_breve": "Descripción técnica muy corta de su apariencia física o vestimenta de trabajo para diferenciarlo"
}

Si no podés identificar una propiedad, dejala en blanco ("").`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://peietools.com',
        'X-Title': 'PEIE Tools'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Error de API: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Respuesta vacía');

    try {
      return JSON.parse(content.trim()) as AnalyzedEmployee;
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as AnalyzedEmployee;
      throw new Error('Respuesta sin formato JSON válido');
    }
  } catch (error: any) {
    console.error('[OpenRouter] Error en analyzeEmployeeImage:', error);
    throw error;
  }
}

/**
 * Interpreta texto libre del usuario y devuelve términos de búsqueda estructurados para encontrar un empleado.
 */
export async function interpretEmployeeInput(userText: string): Promise<{ terminos: string[]; nombre: string; especialidad: string }> {
  let apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    apiKey = localStorage.getItem('VITE_OPENROUTER_API_KEY') || '';
  }
  if (!apiKey) throw new Error('CONFIG_REQUIRED');

  const prompt = `Sos un asistente de logística en una obra. Un usuario te describe a un empleado o lo busca por apodo, nombre parcial, especialidad u obra. Tu trabajo es interpretar la consulta.

Texto del usuario: "${userText}"

Devolvé estrictamente un JSON (sin markdown) con:
{
  "terminos": ["palabras", "clave", "para", "buscar"],
  "nombre": "nombre o apellido interpretado",
  "especialidad": "especialidad interpretada"
}

Ejemplos:
- "busco a juan el chispita" → nombre: "juan", especialidad: "Electricista"
- "el electricista de torre duo" → nombre: "", especialidad: "Electricista"
- "gomez de seguridad" → nombre: "gomez", especialidad: "Seguridad"`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://peietools.com',
        'X-Title': 'PEIE Tools'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Error API: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Respuesta vacía');

    try {
      return JSON.parse(content.trim());
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error('Respuesta sin formato JSON válido');
    }
  } catch (error: any) {
    console.error('[OpenRouter] Error en interpretEmployeeInput:', error);
    throw error;
  }
}

