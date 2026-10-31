import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { isAdminEmail } from "@/lib/adminAuthorization";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const OWNER=process.env.DFL_GITHUB_OWNER?.trim()||"alefe-redes-computadores";
const REPO=process.env.DFL_GITHUB_REPO?.trim()||"da-familia-lanches-v2";
const BRANCH=process.env.DFL_GITHUB_BRANCH?.trim()||"main";
const TOKEN=process.env.DFL_GITHUB_TOKEN?.trim()||"";
async function authenticate(request:NextRequest){
 const bearer=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim()||"";
 if(!bearer)return false;
 const decoded=await adminAuth.verifyIdToken(bearer,true);
 return isAdminEmail(decoded.email);
}
async function github(path:string,init?:RequestInit){return fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{
 ...init,headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${TOKEN}`,"X-GitHub-Api-Version":"2022-11-28",...(init?.headers||{})},cache:"no-store"
});}
export async function POST(request:NextRequest){
 try{
  if(!await authenticate(request))return NextResponse.json({ok:false,error:"AUTH_REQUIRED"},{status:401});
  if(!TOKEN)return NextResponse.json({ok:false,error:"GITHUB_UPLOAD_NOT_CONFIGURED"},{status:503});
  const form=await request.formData();const candidate=form.get("file");
  const id=String(form.get("campaignId")||"");const variant=String(form.get("variant")||"");
  if(!/^[a-z0-9][a-z0-9_-]{2,69}$/.test(id)||!["desktop","mobile"].includes(variant))return NextResponse.json({ok:false,error:"CAMPAIGN_UPLOAD_INVALID"},{status:400});
  if(!(candidate instanceof File)||candidate.type!=="image/webp"||candidate.size<16||candidate.size>640*1024)return NextResponse.json({ok:false,error:"CAMPAIGN_IMAGE_INVALID"},{status:400});
  const bytes=Buffer.from(await candidate.arrayBuffer());
  if(bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WEBP")return NextResponse.json({ok:false,error:"CAMPAIGN_IMAGE_INVALID"},{status:415});
  const digest=createHash("sha256").update(bytes).digest("hex").slice(0,14);
  const path=`public/img/campaign/${id}-${variant}-${digest}.webp`;
  const url=`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`;
  const previous=await github(path);
  if(previous.ok)return NextResponse.json({ok:true,url,reused:true});
  if(previous.status!==404)return NextResponse.json({ok:false,error:"GITHUB_LOOKUP_FAILED"},{status:502});
  const response=await github(path,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:`campaign: add ${id} ${variant} image [skip ci]`,content:bytes.toString("base64"),branch:BRANCH})});
  if(!response.ok)return NextResponse.json({ok:false,error:"GITHUB_WRITE_FAILED"},{status:502});
  return NextResponse.json({ok:true,url});
 }catch(error){console.error("[admin/visual-campaign-image]",error);return NextResponse.json({ok:false,error:"CAMPAIGN_UPLOAD_FAILED"},{status:500});}
}
