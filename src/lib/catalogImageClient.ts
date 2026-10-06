"use client";

export const CATALOG_IMAGE_MAX_EDGE = 1280;
export const CATALOG_IMAGE_TARGET_BYTES = 520 * 1024;
export const CATALOG_IMAGE_ACCEPTED_TYPES = ["image/jpeg","image/png","image/webp"] as const;

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

export async function prepareCatalogImage(file: File) {
  if (!(CATALOG_IMAGE_ACCEPTED_TYPES as readonly string[]).includes(file.type)) throw new Error("IMAGE_TYPE_INVALID");
  const image = await loadImage(file);
  const scale = Math.min(1, CATALOG_IMAGE_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.fillStyle = "#ffffff";
  context.fillRect(0,0,width,height);
  context.drawImage(image,0,0,width,height);

  let quality=.82;
  let blob=await canvasBlob(canvas,quality);
  while(blob.size>CATALOG_IMAGE_TARGET_BYTES && quality>.54){
    quality-=.08;
    blob=await canvasBlob(canvas,quality);
  }
  const stem=file.name.replace(/\.[^.]+$/,"").replace(/[^a-zA-Z0-9_-]+/g,"-")||"produto";
  return new File([blob],`${stem}.webp`,{type:"image/webp",lastModified:Date.now()});
}
