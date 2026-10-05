import fs from "node:fs";
import path from "node:path";
const root="public/img";
const exts=new Set([".png",".jpg",".jpeg",".webp"]);
const rows=[];
function walk(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(exts.has(path.extname(e.name).toLowerCase()))rows.push({path:p.replaceAll("\\","/"),bytes:fs.statSync(p).size});}}
walk(root); rows.sort((a,b)=>b.bytes-a.bytes);
const total=rows.reduce((n,r)=>n+r.bytes,0);
const large=rows.filter(r=>r.bytes>=500*1024);
console.log(`Imagens: ${rows.length} | Total: ${(total/1048576).toFixed(2)} MB | >=500KB: ${large.length}`);
large.slice(0,20).forEach(r=>console.log(`${(r.bytes/1048576).toFixed(2)} MB  ${r.path}`));
