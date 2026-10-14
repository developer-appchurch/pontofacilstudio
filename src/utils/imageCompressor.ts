/**
 * Utilitário de compressão e conversão de imagens para formato WebP leve.
 * Reduz fotos de megabytes para ~15-35 KB mantendo alta fidelidade facial para biometria.
 */
export async function compressImageToWebP(
  input: File | string,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.75
): Promise<{ base64: string; sizeOriginalKb: number; sizeWebpKb: number }> {
  return new Promise((resolve, reject) => {
    let originalSizeKb = 0;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const processImage = () => {
      let width = img.width;
      let height = img.height;

      // Manter proporção
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Falha ao inicializar contexto do Canvas 2D'));
        return;
      }

      // Preenchimento branco de fundo para evitar transparências estranhas
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Desenhar com interpolação suave
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Exportar como image/webp (ou fallback image/jpeg se navegador antigo)
      let webpDataUrl = canvas.toDataURL('image/webp', quality);
      if (!webpDataUrl.startsWith('data:image/webp')) {
        webpDataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      // Calcular tamanho em KB
      const base64Length = webpDataUrl.length - (webpDataUrl.indexOf(',') + 1);
      const sizeWebpKb = Math.round((base64Length * 0.75) / 1024);

      resolve({
        base64: webpDataUrl,
        sizeOriginalKb: Math.max(originalSizeKb, sizeWebpKb),
        sizeWebpKb: Math.max(sizeWebpKb, 1)
      });
    };

    img.onload = processImage;
    img.onerror = () => reject(new Error('Erro ao carregar a imagem para compressão'));

    if (typeof input === 'string') {
      originalSizeKb = Math.round((input.length * 0.75) / 1024);
      img.src = input;
    } else {
      originalSizeKb = Math.round(input.size / 1024);
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(input);
    }
  });
}
