// Utilidades de imagen del escáner: brillo de referencia y normalización de
// archivos subidos (máx. 1280 px, JPEG 0.88) antes de enviarlos al backend.

export function sampleBrightness(canvas) {
  try {
    const sw = 48;
    const sh = 48;
    const tmp = document.createElement("canvas");
    tmp.width = sw;
    tmp.height = sh;
    tmp.getContext("2d").drawImage(canvas, 0, 0, sw, sh);
    const d = tmp.getContext("2d").getImageData(0, 0, sw, sh).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    }
    return sum / (d.length / 4);
  } catch {
    return 0.5;
  }
}

export async function normalizeImageFile(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1280;
      let w = img.naturalWidth || img.width || 640;
      let h = img.naturalHeight || img.height || 480;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const normalizedFile = new File([blob], "rostro.jpg", { type: "image/jpeg" });
            resolve({ file: normalizedFile, previewUrl: URL.createObjectURL(blob) });
          } else {
            resolve({ file, previewUrl: URL.createObjectURL(file) });
          }
        },
        "image/jpeg",
        0.88,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ file, previewUrl: URL.createObjectURL(file) });
    };
    img.src = url;
  });
}
