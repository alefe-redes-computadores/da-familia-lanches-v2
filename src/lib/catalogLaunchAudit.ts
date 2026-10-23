import type { Product } from "@/data/products";
import type { Addon } from "@/data/addons";
import type { CatalogCategory } from "@/lib/catalogCategories";
import { productGroupConfiguration } from "@/lib/catalogModifierGroups";

/** V86 R7 — auditoria de lançamento somente leitura, derivada do catálogo público já carregado. */
export type LaunchSeverity = "critical" | "warning" | "opportunity";
export type LaunchIssue = {
  id: string;
  code: string;
  severity: LaunchSeverity;
  title: string;
  detail: string;
  productId: string;
  productName: string;
  category: string;
};
export type LaunchSummary = {
  issues: LaunchIssue[];
  score: number;
  active: number;
  paused: number;
  visible: number;
  critical: number;
  warnings: number;
  opportunities: number;
  affected: number;
};
const plain = (v: unknown) => String(v ?? "").trim();
const key = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isImage = (v: string) => /^(\/[^\s?#]+\.(?:webp|png|jpe?g)(?:\?.*)?|https:\/\/[^\s]+)$/i.test(v);
const maxItems = 400;

export function inspectCatalogLaunch(products: readonly Product[], addons: readonly Addon[], categories: readonly CatalogCategory[]): LaunchSummary {
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const productMap = new Map(products.map(p => [p.id, p]));
  const addonMap = new Map(addons.map(a => [a.id, a]));
  const issues: LaunchIssue[] = [];
  const fingerprints = new Map<string, string>();
  const add = (product: Product, code: string, severity: LaunchSeverity, title: string, detail: string) => {
    issues.push({id:`${product.id}:${code}`,code,severity,title,detail,productId:product.id,productName:product.name,category:product.category});
  };
  const active = products.filter(p => p.disponivel !== false);
  const visible = active.filter(p => categoryMap.get(p.category)?.active === true);

  for (const product of products.slice(0, maxItems)) {
    const category = categoryMap.get(product.category);
    const selling = product.disponivel !== false;
    if (!category) add(product,"category_missing","critical","Categoria não encontrada","Cadastre ou vincule o produto a uma categoria existente.");
    else if (selling && !category.active) add(product,"category_hidden","warning","Produto ativo em categoria oculta","O cliente não encontrará esse item no cardápio público.");
    if (!selling) continue;

    if (!plain(product.name)) add(product,"name_empty","critical","Produto sem nome","É necessário informar um nome comercial.");
    if (!finite(product.price) || product.price < 0) add(product,"price_invalid","critical","Preço inválido","O preço não pode ser negativo ou não numérico.");
    else if (product.price === 0) add(product,"price_zero","warning","Produto com preço zero","Confirme se é uma oferta gratuita intencional.");
    if (!isImage(plain(product.image))) add(product,"image_missing","warning","Imagem ausente ou endereço incompleto","Utilize uma foto real que corresponda ao produto vendido.");
    if (plain(product.description).length < 24) add(product,"description_short","opportunity","Descrição muito curta","Explique de forma objetiva a composição e o que acompanha o item.");
    if (finite(product.oldPrice) && product.oldPrice <= product.price) add(product,"offer_invalid","critical","Promoção inconsistente","O preço anterior precisa ser maior que o valor de venda.");
    if (product.promoPlacement === "home_showcase" && !finite(product.oldPrice)) add(product,"showcase_no_discount","opportunity","Oferta sem preço anterior","Verifique se o destaque na vitrine é intencional. Não é obrigatório ter desconto.");

    const fingerprint = `${key(product.category)}|${key(product.name)}`;
    if (fingerprints.has(fingerprint)) add(product,"duplicate_name","warning","Nome repetido na categoria",`Outro produto com o mesmo nome: ${fingerprints.get(fingerprint)}.`);
    else fingerprints.set(fingerprint,product.id);

    if (product.category === "bebidas" && (product.addonGroups?.length || (product.addonIds?.length ?? 0)))
      add(product,"beverage_addons","warning","Bebida com personalização vinculada","Confira se o cliente realmente deve escolher adicionais nesta bebida.");
    if (product.addonIds) for (const id of product.addonIds) {
      const addon=addonMap.get(id);
      if (!addon) add(product,`addon_missing_${id}`,"critical","Adicional vinculado não encontrado",`A opção ${id} não existe no catálogo atual.`);
      else if (addon.disponivel === false) add(product,`addon_paused_${id}`,"warning","Adicional pausado ainda vinculado",`A opção ${addon.name} está indisponível.`);
    }
    const groups = productGroupConfiguration(product);
    if (!groups.valid) add(product,"groups_invalid","critical","Regras de personalização incompatíveis",groups.reason || "Revise mínimos, máximos e grupos.");
    else for (const group of groups.groups) {
      const available = group.addonIds.filter(id=>addonMap.get(id)?.disponivel!==false && addonMap.has(id));
      if (available.length < group.min) add(product,`group_impossible_${group.id}`,"critical","Grupo obrigatório sem opções suficientes",`“${group.title}”: mínimo ${group.min}, mas apenas ${available.length} opções estão disponíveis.`);
      for (const id of group.addonIds) if (!addonMap.has(id)) add(product,`group_missing_${group.id}_${id}`,"critical","Grupo vinculado a adicional inexistente",`“${group.title}”: o adicional ${id} não está cadastrado.`);
    }

    if (product.bundleItems?.length) {
      // DFS limitado ao catálogo em memória: detecta também ciclos indiretos A -> B -> A.
      const traverse = (id: string, trail: Set<string>, depth: number): boolean => {
        if (id === product.id) return true;
        if (depth >= 12 || trail.has(id)) return false;
        const next = productMap.get(id);
        if (!next?.bundleItems?.length) return false;
        const nextTrail = new Set(trail); nextTrail.add(id);
        return next.bundleItems.some(item => traverse(item.productId, nextTrail, depth + 1));
      };
      if (product.bundleItems.some(item=>traverse(item.productId,new Set([product.id]),0)))
        add(product,"bundle_cycle","critical","Composição circular entre combos","Um combo contém outro que volta a apontar para o primeiro. Revise os vínculos.");
      const seen = new Set<string>();
      for(const item of product.bundleItems) {
        const linked=productMap.get(item.productId);
        if(seen.has(item.productId)) add(product,`bundle_duplicate_${item.productId}`,"warning","Componente duplicado no combo","Confira as quantidades e remova linhas repetidas se não forem intencionais.");
        seen.add(item.productId);
        if (!linked) add(product,`bundle_missing_${item.productId}`,"critical","Combo aponta para produto inexistente",`Componente ${item.productId} não foi encontrado.`);
        else if (linked.disponivel === false) add(product,`bundle_paused_${item.productId}`,"critical","Combo disponível com componente pausado",`${linked.name} está pausado. Revise a disponibilidade do combo antes de vender.`);
        else if (linked.id === product.id) add(product,"bundle_self","critical","Combo aponta para si mesmo","Remova a referência circular.");
        if (!Number.isInteger(item.quantity) || item.quantity < 1) add(product,`bundle_qty_${item.productId}`,"critical","Quantidade de componente inválida","Cada componente precisa ter quantidade inteira positiva.");
      }
    }
    if (product.upsellProductId) {
      const extra=productMap.get(product.upsellProductId);
      if (!extra || extra.disponivel===false) add(product,"upsell_missing","warning","Oferta Turbine sem produto ativo","O produto complementar não está disponível no catálogo.");
      else if (!finite(product.upsellUnitPrice) || product.upsellUnitPrice < 0 || product.upsellUnitPrice >= extra.price)
        add(product,"upsell_price","warning","Oferta Turbine sem preço especial válido","Defina um preço explícito inferior ao preço normal do produto complementar.");
    }
  }
  const weight: Record<LaunchSeverity, number> = {critical:12,warning:4,opportunity:1};
  const score = Math.max(0,100-Math.min(100,issues.reduce((total,item)=>total+weight[item.severity],0)));
  const level: Record<LaunchSeverity,number> = {critical:0,warning:1,opportunity:2};
  issues.sort((a,b)=>level[a.severity]-level[b.severity] || a.productName.localeCompare(b.productName,"pt-BR") || a.code.localeCompare(b.code));
  return {issues,score,active:active.length,paused:products.length-active.length,visible:visible.length,
    critical:issues.filter(i=>i.severity==="critical").length,warnings:issues.filter(i=>i.severity==="warning").length,
    opportunities:issues.filter(i=>i.severity==="opportunity").length,affected:new Set(issues.map(i=>i.productId)).size};
}

export function launchReportText(report:LaunchSummary,source:string):string {
 const title=`DFL SITE — Revisão local do catálogo V86 R7`;
 const lines=[title,`Fonte: ${source}`,`Nota de triagem: ${report.score}/100 (indicador heurístico, não mede vendas)`,
 `Produtos: ${report.active} ativos, ${report.paused} pausados, ${report.visible} visíveis`,
 `Alertas: ${report.critical} críticos, ${report.warnings} atenções, ${report.opportunities} oportunidades`,
 `Importante: diagnóstico local; não atesta deploy, infraestrutura, atendimento ou aprovação na plataforma.`,""];
 for(const item of report.issues)lines.push(`[${item.severity}] ${item.productName} (${item.productId}) — ${item.title}: ${item.detail}`);
 return lines.join("\n");
}
