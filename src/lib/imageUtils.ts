/**
 * Comprime una imagen del input file a un tamaño razonable
 * y la devuelve como base64 data URL para guardar en la BD.
 */
export function compressImage(file: File, maxWidth = 800, quality = 0.65): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        // Escalar si excede el ancho máximo
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('No canvas context'); return; }
        
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject('Error cargando imagen');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject('Error leyendo archivo');
    reader.readAsDataURL(file);
  });
}
