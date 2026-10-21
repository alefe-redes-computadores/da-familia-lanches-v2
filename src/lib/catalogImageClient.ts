"use client";

export const CATALOG_IMAGE_MAX_EDGE = 1280;
export const CATALOG_IMAGE_TARGET_BYTES = 520 * 1024;
export const CATALOG_IMAGE_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("IMAGE_DECODE_FAILED")); };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("IMAGE_ENCODE_FAILED")), "image/webp", quality),
  );
}

/** Converte as fotos de alta resolucao antes do upload; servidor aceita so WebP ate 640 KB. */
export async function prepareCatalogImage(file: File) {
  if (!(CATALOG_IMAGE_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("IMAGE_TYPE_INVALID");
  }
  const image = await loadImage(file);
  const originalEdge = Math.max(image.naturalWidth, image.naturalHeight);
  if (!originalEdge) throw new Error("IMAGE_DECODE_FAILED");
  const initialScale = Math.min(1, CATALOG_IMAGE_MAX_EDGE / originalEdge);
  const stem = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "produto";

  // Fotos detalhadas e geradas por IA podem ultrapassar 640 KB mesmo com WebP.
  // Reduz gradualmente a resolucao, nunca aumenta a imagem nem envia PNG fingindo ser WebP.
  for (const factor of [1, 0.84, 0.70, 0.58, 0.48]) {
    const width = Math.max(1, Math.round(image.naturalWidth * initialScale * factor));
    const height = Math.max(1, Math.round(image.naturalHeight * initialScale * factor));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("CANVAS_UNAVAILABLE");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.type !== "image/webp") throw new Error("WEBP_NOT_SUPPORTED");
      if (blob.size <= CATALOG_IMAGE_TARGET_BYTES) {
        return new File([blob], `${stem}.webp`, { type: "image/webp", lastModified: Date.now() });
      }
    }
  }
  throw new Error("IMAGE_TOO_LARGE_AFTER_COMPRESSION");
}
