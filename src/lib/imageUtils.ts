/**
 * Comprime una imagen de forma ultraliviana (evitando picos de memoria en celulares)
 * utilizando URL.createObjectURL y Canvas HTML5.
 */
export function compressImage(file: File, maxWidth = 800, quality = 0.65): Promise<string> {
  return new Promise((resolve, reject) => {
    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      // Fallback para entornos donde createObjectURL falle
    }

    const img = new Image();
    img.onload = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      try {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        // Escalar manteniendo proporción si excede el ancho máximo
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('No se pudo obtener el contexto del lienzo (Canvas)');
          return;
        }

        // Dibujar y comprimir a JPEG optimizado
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      } catch (canvasErr) {
        reject(canvasErr);
      }
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject('Error al decodificar la imagen');
    };

    if (objectUrl) {
      img.src = objectUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject('Error leyendo archivo');
      reader.readAsDataURL(file);
    }
  });
}
