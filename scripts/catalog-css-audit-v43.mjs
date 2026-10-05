import fs from"node:fs";
const css=fs.readFileSync("src/components/admin/CatalogAdmin.module.css","utf8");
const clean=css.replace(/\/\*[\s\S]*?\*\//g,"");
const forced=(clean.match(/!important/g)||[]).length;
console.log(`CatalogAdmin CSS: ${css.split("\n").length} linhas | ${forced} prioridades forçadas`);
