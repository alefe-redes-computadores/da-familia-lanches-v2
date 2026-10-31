"use client";

/** Derivado do pipeline WebP do catálogo, com limite de dimensão próprio para banners. */
export async function prepareCampaignBanner(file:File):Promise<File> {
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>12*1024*1024)throw Error("CAMPAIGN_IMAGE_TYPE_OR_SIZE_INVALID");
  const url=URL.createObjectURL(file);
  let image:HTMLImageElement;
  try {
    image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error("CAMPAIGN_IMAGE_DECODE_FAILED"));img.src=url;
    });
  }finally { URL.revokeObjectURL(url); }
  if(!image.naturalWidth||!image.naturalHeight)throw Error("CAMPAIGN_IMAGE_DECODE_FAILED");
  // 3:1 horizontal e formato vertical aceitos; nunca recorta texto/valores.
  const base=Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight));
  for(const factor of [1,.9,.8,.7,.6]){
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(image.naturalWidth*base*factor));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*base*factor));
    const context=canvas.getContext("2d",{alpha:false});if(!context)throw Error("CAMPAIGN_CANVAS_UNAVAILABLE");
    context.fillStyle="#0B0B0D";context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
    for(const quality of [.86,.78,.68,.58]){
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("CAMPAIGN_WEBP_FAILED")),"image/webp",quality));
      if(blob.type!=="image/webp")throw Error("CAMPAIGN_WEBP_UNAVAILABLE");
      if(blob.size<560*1024)return new File([blob],"campaign-banner.webp",{type:"image/webp"});
    }
  }
  throw Error("CAMPAIGN_IMAGE_TOO_LARGE");
}
