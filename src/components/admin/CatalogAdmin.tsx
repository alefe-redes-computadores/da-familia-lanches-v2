"use client";

import { useMemo, useState } from "react";
import { deleteDoc, deleteField, doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { products as fallbackProducts, type Product, type ProductCategory } from "@/data/products";
import { ADDONS as fallbackAddons, type Addon } from "@/data/addons";
import { useCatalog } from "@/hooks/useCatalog";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { CATALOG_ADDONS_COLLECTION, CATALOG_PRODUCTS_COLLECTION } from "@/lib/catalog";
import { CATALOG_CATEGORIES_COLLECTION, FALLBACK_CATEGORIES, type CatalogCategory } from "@/lib/catalogCategories";
import styles from "./CatalogAdmin.module.css";


type ProductDraft = {
  id: string;
  name: string;
  description: string;
  price: string;
  oldPrice: string;
  image: string;
  category: ProductCategory;
  disponivel: boolean;
  isSuggestion: boolean;
  showInOffers: boolean;
  sortOrder: string;
  addonIds?: string[];
  detailsTitle: string;
  detailsItems: string;
  includedExtras: string;
  bundleItems: Array<{ productId: string; quantity: number; note: string }>;
};

type AddonDraft = {
  id: string;
  name: string;
  price: string;
  disponivel: boolean;
  sortOrder: string;
};

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

type ChoiceOption<T extends string> = { value: T; label: string };

function ChoicePicker<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Array<ChoiceOption<T>>;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value)?.label ?? value;

  return <>
    <button type="button" className={styles.choiceButton} onClick={() => setOpen(true)}>
      <span>{label}</span><strong>{selected}</strong><i>v</i>
    </button>
    {open && <div className={styles.choiceOverlay} onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section className={styles.choiceSheet}>
        <div className={styles.choiceHead}><div><span>SELECIONE</span><strong>{label}</strong></div><button type="button" onClick={() => setOpen(false)}>×</button></div>
        <div className={styles.choiceList}>
          {options.map((option) => <button type="button" key={option.value} data-active={option.value === value} onClick={() => {
            onChange(option.value);
            setOpen(false);
          }}><span>{option.label}</span><i /></button>)}
        </div>
      </section>
    </div>}
  </>;
}

function nextId(name: string, used: Set<string>) {
  const base = slugify(name) || "produto";
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parseMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
function moneyDraft(value: string) {
  const number = parseMoneyInput(value);
  return number == null ? "" : number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function promoMetrics(priceText: string, oldPriceText: string) {
  const price = parseMoneyInput(priceText);
  const oldPrice = parseMoneyInput(oldPriceText);
  if (price == null || oldPrice == null || oldPrice <= price || oldPrice <= 0) return null;
  const saving = oldPrice - price;
  return { price, oldPrice, saving, percent: Math.round((saving / oldPrice) * 100) };
}

const draftFromProduct = (product: Product): ProductDraft => ({
  id: product.id,
  name: product.name,
  description: product.description,
  price: String(product.price),
  oldPrice: product.oldPrice == null ? "" : String(product.oldPrice),
  image: product.image,
  category: product.category,
  disponivel: product.disponivel,
  isSuggestion: Boolean(product.isSuggestion),
  showInOffers: product.promoPlacement === "home_showcase" || (product.promoPlacement == null && Boolean(product.isSuggestion) && typeof product.oldPrice === "number" && product.oldPrice > product.price),
  sortOrder: product.sortOrder == null ? "" : String(product.sortOrder),
  addonIds: product.addonIds,
  detailsTitle: product.detailsTitle ?? "",
  detailsItems: product.detailsItems?.join("\n") ?? "",
  includedExtras: product.includedExtras ?? "",
  bundleItems: (product.bundleItems ?? []).map((item) => ({ productId: item.productId, quantity: item.quantity, note: item.note ?? "" })),
});

const draftFromAddon = (addon: Addon): AddonDraft => ({
  id: addon.id,
  name: addon.name,
  price: String(addon.price),
  disponivel: addon.disponivel !== false,
  sortOrder: addon.sortOrder == null ? "" : String(addon.sortOrder),
});

export function CatalogAdmin() {
  const { products, addons, allAddons, source, remoteProducts, remoteAddons, loading } = useCatalog();
  const { categories, remoteCategories, loading: categoriesLoading } = useCatalogCategories();
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [productMode, setProductMode] = useState<"create" | "edit" | null>(null);
  const [addonDraft, setAddonDraft] = useState<AddonDraft | null>(null);
  const [addonMode, setAddonMode] = useState<"create" | "edit" | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ProductCategory>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "active" | "paused">("all");
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<{ id: string; label: string; mode: "create" | "edit" } | null>(null);
  const [categoryDeleteConfirm, setCategoryDeleteConfirm] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      if (categoryFilter !== "all" && product.category !== categoryFilter) return false;
      if (availabilityFilter === "active" && !product.disponivel) return false;
      if (availabilityFilter === "paused" && product.disponivel) return false;
      if (!term) return true;
      return product.name.toLocaleLowerCase("pt-BR").includes(term) || product.description.toLocaleLowerCase("pt-BR").includes(term) || product.id.toLocaleLowerCase("pt-BR").includes(term);
    }).sort((a, b) => {
      if (availabilityFilter === "all" && a.disponivel !== b.disponivel) return a.disponivel ? -1 : 1;
      return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
    });
  }, [products, search, categoryFilter, availabilityFilter]);

  const groupedProducts = useMemo(() => {
    const order = new Map(categories.map((category, index) => [category.id, index]));
    const groups = new Map<string, Product[]>();
    for (const product of filteredProducts) {
      const list = groups.get(product.category) ?? [];
      list.push(product);
      groups.set(product.category, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999) || a.localeCompare(b, "pt-BR"))
      .map(([categoryId, items]) => ({ categoryId, label: categories.find((category) => category.id === categoryId)?.label ?? categoryId, items }));
  }, [filteredProducts, categories]);

  const activeProducts = products.filter((product) => product.disponivel).length;
  const pausedProducts = products.length - activeProducts;
  const activeAddons = allAddons.filter((addon) => addon.disponivel !== false).length;

  const categoryOptions = categories.map((category) => ({ value: category.id, label: `${category.label}${category.active ? "" : " (oculta)"}` }));
  const categoryLabel = (id: string) => categories.find((category) => category.id === id)?.label ?? id;
  const productsInCategory = (id: string) => products.filter((product) => product.category === id);

  const openCreateProduct = () => {
    setProductMode("create");
    setProductDraft({ id: "", name: "", description: "", price: "", oldPrice: "", image: "", category: categories.find((category) => category.active)?.id ?? "tradicionais", disponivel: true, isSuggestion: false, showInOffers: false, sortOrder: "", addonIds: undefined, detailsTitle: "", detailsItems: "", includedExtras: "", bundleItems: [] });
    setMessage("");
  };

  const openEditProduct = (product: Product) => {
    setProductMode("edit");
    setProductDraft(draftFromProduct(product));
    setMessage("");
  };

  const uploadProductImage = async (file: File) => {
    if (!productDraft) return;
    if (!file.type.startsWith("image/")) return setMessage("Escolha uma imagem.");
    if (file.size > 6 * 1024 * 1024) return setMessage("A foto deve ter no máximo 6 MB.");
    setUploadingImage(true); setMessage("");
    try {
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
      const base=(productDraft.id||productDraft.name||"produto").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"produto";
      const objectRef=ref(storage,`catalog/products/${base}-${Date.now()}.${ext}`);
      await uploadBytes(objectRef,file,{contentType:file.type,customMetadata:{scope:"catalog-product"}});
      const url=await getDownloadURL(objectRef);
      setProductDraft(d=>d?{...d,image:url}:d); setMessage("Foto enviada. Agora salve o produto.");
    } catch(error){console.error(error);setMessage("Falha no upload. Confira se as regras do Storage foram publicadas.");}
    finally{setUploadingImage(false);}
  };

  const saveProduct = async () => {
    if (!productDraft || !productMode) return;
    const price = parseMoneyInput(productDraft.price);
    const oldPrice = productDraft.oldPrice.trim() ? parseMoneyInput(productDraft.oldPrice) : null;
    const sortOrder = productDraft.sortOrder.trim() ? Number(productDraft.sortOrder) : null;

    if (!productDraft.name.trim()) return setMessage("Informe o nome do produto.");
    if (!productDraft.description.trim()) return setMessage("Informe a descrição do produto.");
    if (!productDraft.image.trim()) return setMessage("Informe a imagem ou caminho do produto.");
    if (price === null || price < 0) return setMessage("Informe um preço válido.");
    if (oldPrice !== null && oldPrice < 0) return setMessage("Preço anterior inválido.");
    if (oldPrice !== null && oldPrice <= price) return setMessage("Para criar promoção, o preço anterior precisa ser maior que o preço atual.");

    const usedIds = new Set(products.map((product) => product.id));
    const id = productMode === "edit" ? productDraft.id : nextId(productDraft.name, usedIds);

    setBusy(`product-${id}`);
    try {
      const payload: Record<string, unknown> = {
        id,
        name: productDraft.name.trim(),
        description: productDraft.description.trim(),
        price,
        oldPrice: oldPrice ?? deleteField(),
        image: productDraft.image.trim(),
        category: productDraft.category,
        disponivel: productDraft.disponivel,
        isSuggestion: productDraft.isSuggestion,
        promoPlacement: productDraft.showInOffers ? "home_showcase" : "none",
        sortOrder: sortOrder !== null && Number.isFinite(sortOrder) ? sortOrder : deleteField(),
        detailsTitle: productDraft.detailsTitle.trim() || deleteField(),
        detailsItems: productDraft.detailsItems.split("\n").map((item) => item.trim()).filter(Boolean),
        includedExtras: productDraft.includedExtras.trim() || deleteField(),
        bundleItems: productDraft.bundleItems.length ? productDraft.bundleItems.map((item) => ({ productId: item.productId, quantity: Math.max(1, Math.trunc(item.quantity || 1)), ...(item.note.trim() ? { note: item.note.trim() } : {}) })) : deleteField(),
        updatedAt: serverTimestamp(),
      };

      if (productDraft.category === "bebidas") payload.addonIds = [];
      else payload.addonIds = productDraft.addonIds ?? deleteField();

      await setDoc(doc(db, CATALOG_PRODUCTS_COLLECTION, id), payload, { merge: true });
      setProductDraft(null);
      setProductMode(null);
      setMessage(productMode === "create" ? `Produto criado com ID ${id}.` : "Produto atualizado.");
    } catch (error) {
      console.error(error);
      setMessage("Não foi possível salvar o produto.");
    } finally {
      setBusy("");
    }
  };

  const toggleProduct = async (product: Product) => {
    setBusy(`toggle-${product.id}`);
    try {
      await setDoc(doc(db, CATALOG_PRODUCTS_COLLECTION, product.id), {
        id: product.id, name: product.name, description: product.description, price: product.price,
        oldPrice: product.oldPrice ?? deleteField(), image: product.image, category: product.category,
        disponivel: !product.disponivel, isSuggestion: Boolean(product.isSuggestion), promoPlacement: product.promoPlacement ?? deleteField(),
        sortOrder: product.sortOrder ?? deleteField(), addonIds: product.addonIds ?? deleteField(), updatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage(product.disponivel ? "Produto pausado." : "Produto reativado.");
    } catch (error) {
      console.error(error);
      setMessage("Falha ao alterar a disponibilidade.");
    } finally {
      setBusy("");
    }
  };

  const seedCatalog = async () => {
    if (!confirmSeed) {
      setConfirmSeed(true);
      return;
    }

    setBusy("seed");
    setMessage("");
    try {
      const batch = writeBatch(db);
      FALLBACK_CATEGORIES.forEach((category) => batch.set(doc(db, CATALOG_CATEGORIES_COLLECTION, category.id), { ...category, migratedFromFallback: true, updatedAt: serverTimestamp() }, { merge: true }));
      fallbackProducts.forEach((product, index) => {
        batch.set(doc(db, CATALOG_PRODUCTS_COLLECTION, product.id), {
          ...product,
          oldPrice: product.oldPrice ?? null,
          isSuggestion: Boolean(product.isSuggestion),
          sortOrder: product.sortOrder ?? index,
          addonIds: product.addonIds ?? null,
          migratedFromFallback: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      fallbackAddons.forEach((addon, index) => {
        batch.set(doc(db, CATALOG_ADDONS_COLLECTION, addon.id), {
          ...addon,
          disponivel: addon.disponivel !== false,
          sortOrder: addon.sortOrder ?? index,
          migratedFromFallback: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
      setConfirmSeed(false);
      setMessage("Catálogo-base sincronizado sem remover itens criados no Admin.");
    } catch (error) {
      console.error(error);
      setMessage("Não foi possível sincronizar o catálogo-base.");
    } finally {
      setBusy("");
    }
  };

  const saveCategory = async () => {
    if (!categoryDraft) return;
    const label = categoryDraft.label.trim();
    if (!label) return setMessage("Informe o nome da categoria.");
    const id = categoryDraft.mode === "edit" ? categoryDraft.id : slugify(label);
    if (!id) return setMessage("Nome de categoria inválido.");
    if (categoryDraft.mode === "create" && categories.some((category) => category.id === id)) return setMessage("Já existe uma categoria com esse nome.");
    setBusy(`category-${id}`);
    try {
      const existing = categories.find((category) => category.id === id);
      await setDoc(doc(db, CATALOG_CATEGORIES_COLLECTION, id), { id, label, active: existing?.active ?? true, sortOrder: existing?.sortOrder ?? (categories.length ? Math.max(...categories.map((category) => category.sortOrder)) + 10 : 0), updatedAt: serverTimestamp() }, { merge: true });
      setCategoryDraft(null); setMessage(categoryDraft.mode === "create" ? "Categoria criada." : "Categoria atualizada.");
    } catch (error) { console.error(error); setMessage("Não foi possível salvar a categoria."); }
    finally { setBusy(""); }
  };

  const toggleCategory = async (category: CatalogCategory) => {
    setBusy(`category-toggle-${category.id}`);
    try { await setDoc(doc(db, CATALOG_CATEGORIES_COLLECTION, category.id), { ...category, active: !category.active, updatedAt: serverTimestamp() }, { merge: true }); if (categoryFilter === category.id && category.active) setCategoryFilter("all"); setMessage(category.active ? "Categoria ocultada da vitrine." : "Categoria reativada."); }
    catch (error) { console.error(error); setMessage("Não foi possível alterar a categoria."); }
    finally { setBusy(""); }
  };

  const moveCategory = async (category: CatalogCategory, direction: -1 | 1) => {
    const ordered=[...categories].sort((a,b)=>a.sortOrder-b.sortOrder||a.label.localeCompare(b.label,"pt-BR")); const index=ordered.findIndex((item)=>item.id===category.id); const target=index+direction; if(index<0||target<0||target>=ordered.length)return;
    [ordered[index],ordered[target]]=[ordered[target],ordered[index]]; setBusy(`category-order-${category.id}`);
    try { const batch=writeBatch(db); ordered.forEach((item,pos)=>batch.set(doc(db,CATALOG_CATEGORIES_COLLECTION,item.id),{id:item.id,label:item.label,active:item.active,sortOrder:pos*10,updatedAt:serverTimestamp()},{merge:true})); await batch.commit(); setMessage("Ordem das categorias atualizada."); }
    catch(error){console.error(error);setMessage("Não foi possível reordenar as categorias.");} finally{setBusy("");}
  };

  const removeCategory = async (category: CatalogCategory) => {
    const count=productsInCategory(category.id).length; if(count>0){setCategoryDeleteConfirm(null);return setMessage(`Não dá para excluir "${category.label}": existem ${count} produto(s) nela. Mova os produtos primeiro.`);} if(categoryDeleteConfirm!==category.id){setCategoryDeleteConfirm(category.id);return setMessage(`Toque novamente em excluir para confirmar "${category.label}".`);}
    setBusy(`category-delete-${category.id}`); try{await deleteDoc(doc(db,CATALOG_CATEGORIES_COLLECTION,category.id));setCategoryDeleteConfirm(null);setMessage("Categoria vazia excluída.");}catch(error){console.error(error);setMessage("Não foi possível excluir a categoria.");}finally{setBusy("");}
  };

  const moveProduct = async (product: Product, direction: -1 | 1) => {
    const ordered=products.filter((item)=>item.category===product.category&&item.disponivel!==false).sort((a,b)=>(a.sortOrder??Number.MAX_SAFE_INTEGER)-(b.sortOrder??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name,"pt-BR")); const index=ordered.findIndex((item)=>item.id===product.id); const target=index+direction; if(index<0||target<0||target>=ordered.length)return;
    [ordered[index],ordered[target]]=[ordered[target],ordered[index]]; setBusy(`product-order-${product.id}`);
    try{const batch=writeBatch(db);ordered.forEach((item,pos)=>batch.set(doc(db,CATALOG_PRODUCTS_COLLECTION,item.id),{sortOrder:pos*10,updatedAt:serverTimestamp()},{merge:true}));await batch.commit();setMessage(`Ordem de ${categoryLabel(product.category)} atualizada.`);}catch(error){console.error(error);setMessage("Não foi possível reordenar os produtos.");}finally{setBusy("");}
  };

  const openCreateAddon = () => {
    setAddonMode("create");
    setAddonDraft({ id: "", name: "", price: "", disponivel: true, sortOrder: "" });
    setMessage("");
  };

  const openEditAddon = (addon: Addon) => {
    setAddonMode("edit");
    setAddonDraft(draftFromAddon(addon));
    setMessage("");
  };

  const saveAddon = async () => {
    if (!addonDraft || !addonMode) return;
    const price = parseMoneyInput(addonDraft.price);
    const sortOrder = addonDraft.sortOrder.trim() ? Number(addonDraft.sortOrder) : null;
    if (!addonDraft.name.trim()) return setMessage("Informe o nome do adicional.");
    if (price === null || price < 0) return setMessage("Informe um preço válido para o adicional.");

    const usedIds = new Set(allAddons.map((addon) => addon.id));
    const id = addonMode === "edit" ? addonDraft.id : nextId(addonDraft.name, usedIds);

    setBusy(`addon-${id}`);
    try {
      await setDoc(doc(db, CATALOG_ADDONS_COLLECTION, id), {
        id,
        name: addonDraft.name.trim(),
        price,
        disponivel: addonDraft.disponivel,
        sortOrder: sortOrder !== null && Number.isFinite(sortOrder) ? sortOrder : deleteField(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setAddonDraft(null);
      setAddonMode(null);
      setMessage(addonMode === "create" ? `Adicional criado com ID ${id}.` : "Adicional atualizado.");
    } catch (error) {
      console.error(error);
      setMessage("Não foi possível salvar o adicional.");
    } finally {
      setBusy("");
    }
  };

  const toggleAddon = async (addon: Addon) => {
    setBusy(`addon-toggle-${addon.id}`);
    try {
      await setDoc(doc(db, CATALOG_ADDONS_COLLECTION, addon.id), {
        id: addon.id,
        name: addon.name,
        price: addon.price,
        disponivel: addon.disponivel === false,
        sortOrder: addon.sortOrder ?? null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage(addon.disponivel === false ? "Adicional reativado." : "Adicional pausado.");
    } catch (error) {
      console.error(error);
      setMessage("Falha ao alterar o adicional.");
    } finally {
      setBusy("");
    }
  };

  if (loading || categoriesLoading) return <div className={styles.state}>Carregando catálogo...</div>;

  return <div className={styles.root}>
    <section className={styles.summary}>
      <div className={styles.summaryCopy}>
        <span>FONTE ATUAL</span>
        <strong>{source === "hybrid" ? "Catálogo remoto operacional" : "Fallback local ativo"}</strong>
        <p>{remoteProducts} produtos, {remoteAddons} adicionais e {remoteCategories} categorias com versão remota.</p>
      </div>
      <div className={styles.summaryActions}>
        <button className={styles.secondaryAction} onClick={() => setCategoryDraft({ id: "", label: "", mode: "create" })}>+ Categoria</button><button className={styles.secondaryAction} onClick={openCreateAddon}>+ Adicional</button>
        <button className={styles.mainAction} onClick={openCreateProduct}>+ Novo produto</button>
      </div>
    </section>

    <section className={styles.metrics}>
      <div><span>Produtos</span><strong>{products.length}</strong></div>
      <div><span>Disponíveis</span><strong>{activeProducts}</strong></div>
      <div><span>Pausados</span><strong>{pausedProducts}</strong></div>
      <div><span>Adicionais ativos</span><strong>{activeAddons}</strong></div>
    </section>

    {message && <div className={styles.message}><span>{message}</span><button onClick={() => setMessage("")}>×</button></div>}

    <section className={styles.catalogTools}>
      <div className={styles.searchWrap}><span>BUSCAR</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, descrição ou ID" /></div>
      <ChoicePicker label="Categoria" value={categoryFilter} onChange={setCategoryFilter} options={[
        { value: "all", label: "Todas as categorias" },
        ...categoryOptions,
      ]} />
      <ChoicePicker label="Estado" value={availabilityFilter} onChange={setAvailabilityFilter} options={[
        { value: "all", label: "Todos os estados" },
        { value: "active", label: "Disponíveis" },
        { value: "paused", label: "Pausados" },
      ]} />
    </section>

    <div className={styles.sectionBar}>
      <div><span>PRODUTOS</span><strong>{filteredProducts.length} exibidos</strong></div>
      {(search || categoryFilter !== "all" || availabilityFilter !== "all") && <button onClick={() => { setSearch(""); setCategoryFilter("all"); setAvailabilityFilter("all"); }}>Limpar filtros</button>}
    </div>

    <div className={styles.productGroups}>
      {groupedProducts.map((group) => <details className={styles.productGroup} key={group.categoryId} open={Boolean(search || categoryFilter !== "all" || availabilityFilter !== "all")}>
        <summary><div><span>CATEGORIA</span><strong>{group.label}</strong></div><b>{group.items.length} produto{group.items.length===1?"":"s"}</b><i>⌄</i></summary>
        <div className={styles.products}>
          {group.items.map((product) => <article className={styles.product} key={product.id} data-off={!product.disponivel}>
            <img src={product.image} alt="" />
            <div className={styles.productInfo}>
              <div className={styles.productTitle}><div><strong>{product.name}</strong><span>{product.id}</span></div><div className={styles.productBadges}>{product.isSuggestion && <b>Sugestão da casa</b>}{(product.promoPlacement === "home_showcase" || (product.promoPlacement == null && product.isSuggestion && typeof product.oldPrice === "number" && product.oldPrice > product.price)) && <b>Ofertas da Família</b>}</div></div>
              <p>{product.description}</p>
              <div className={styles.productBottom}><div className={styles.adminPrice}>{typeof product.oldPrice === "number" && product.oldPrice > product.price && <small>{money(product.oldPrice)}</small>}<strong>{money(product.price)}</strong>{typeof product.oldPrice === "number" && product.oldPrice > product.price && <b>-{Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%</b>}</div><span data-active={product.disponivel}>{product.disponivel ? "Disponível" : "Pausado"}</span></div>
            </div>
            <div className={styles.actions}>
              {product.disponivel ? <div className={styles.orderActions}><button title="Subir produto" onClick={() => moveProduct(product, -1)} disabled={busy.startsWith("product-order-")}>↑</button><button title="Descer produto" onClick={() => moveProduct(product, 1)} disabled={busy.startsWith("product-order-")}>↓</button></div> : <div className={styles.orderPlaceholder}>Fora da ordem pública</div>}
              <button onClick={() => toggleProduct(product)} disabled={busy === `toggle-${product.id}`}>{product.disponivel ? "Pausar" : "Reativar"}</button>
              <button className={styles.primary} onClick={() => openEditProduct(product)}>Editar</button>
            </div>
          </article>)}
        </div>
      </details>)}
      {!filteredProducts.length && <div className={styles.empty}><strong>Nenhum produto encontrado</strong><span>Altere os filtros ou crie um novo produto.</span></div>}
    </div>

    <section className={styles.categoryPanel}>
      <div className={styles.sectionBar}><div><span>CATEGORIAS & ORDEM DA HOME</span><strong>{categories.length} cadastradas</strong><small className={styles.sectionHint}>Use ↑ ↓ para definir a sequência pública.</small></div><button onClick={() => setCategoryDraft({ id: "", label: "", mode: "create" })}>+ Nova categoria</button></div>
      <div className={styles.categoryGrid}>{categories.map((category,index)=>{const count=productsInCategory(category.id).length;return <article key={category.id} className={styles.categoryCard} data-off={!category.active}><div className={styles.categoryMain}><div><strong>{category.label}</strong><span>{category.id} · {count} produto{count===1?"":"s"}</span></div><b>{category.active?"VISÍVEL":"OCULTA"}</b></div><div className={styles.categoryActions}><button disabled={index===0||busy.startsWith("category-order-")} onClick={()=>moveCategory(category,-1)}>↑</button><button disabled={index===categories.length-1||busy.startsWith("category-order-")} onClick={()=>moveCategory(category,1)}>↓</button><button onClick={()=>setCategoryDraft({id:category.id,label:category.label,mode:"edit"})}>Renomear</button><button onClick={()=>toggleCategory(category)} disabled={busy===`category-toggle-${category.id}`}>{category.active?"Ocultar":"Reativar"}</button><button className={styles.dangerAction} data-confirm={categoryDeleteConfirm===category.id} onClick={()=>removeCategory(category)} disabled={busy===`category-delete-${category.id}`}>{categoryDeleteConfirm===category.id?"Confirmar":"Excluir"}</button></div></article>})}</div>
    </section>

    <section className={styles.addonsPanel}>
      <div className={styles.sectionBar}><div><span>ADICIONAIS</span><strong>{allAddons.length} cadastrados</strong></div><button onClick={openCreateAddon}>+ Novo adicional</button></div>
      <div className={styles.addonGrid}>
        {allAddons.map((addon) => <article key={addon.id} className={styles.addonCard} data-off={addon.disponivel === false}>
          <button className={styles.addonEdit} onClick={() => openEditAddon(addon)}><div><span>{addon.name}</span><small>{addon.id}</small></div><b>{money(addon.price)}</b></button>
          <button className={styles.addonToggle} onClick={() => toggleAddon(addon)} disabled={busy === `addon-toggle-${addon.id}`}>{addon.disponivel === false ? "Reativar" : "Pausar"}</button>
        </article>)}
      </div>
    </section>

    <section className={styles.maintenance}>
      <div><span>MANUTENÇÃO</span><strong>Fallback local</strong><p>Reaplica categorias, produtos e adicionais-base no Firestore sem remover itens criados pelo Admin.</p></div>
      <button data-confirm={confirmSeed} onClick={seedCatalog} disabled={busy === "seed"}>{busy === "seed" ? "Sincronizando..." : confirmSeed ? "Confirmar sincronização" : "Sincronizar catálogo-base"}</button>
      {confirmSeed && <button className={styles.cancelSeed} onClick={() => setConfirmSeed(false)}>Cancelar</button>}
    </section>

    {categoryDraft && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setCategoryDraft(null); }}>
      <section className={styles.smallEditor}><div className={styles.editorHead}><div><span>{categoryDraft.mode === "create" ? "NOVA CATEGORIA" : "EDITAR CATEGORIA"}</span><h3>{categoryDraft.mode === "create" ? "Criar seção do cardápio" : categoryDraft.label}</h3></div><button onClick={() => setCategoryDraft(null)}>×</button></div>{categoryDraft.mode === "edit" && <div className={styles.idBox}><span>ID permanente</span><strong>{categoryDraft.id}</strong></div>}<label>Nome<input autoFocus value={categoryDraft.label} onChange={(e) => setCategoryDraft({ ...categoryDraft, label: e.target.value })} placeholder="Ex.: Porções" /></label><p className={styles.categoryHint}>O ID é permanente: renomear não quebra os produtos vinculados.</p><div className={styles.editorActions}><button onClick={() => setCategoryDraft(null)}>Cancelar</button><button className={styles.save} onClick={saveCategory} disabled={busy.startsWith("category-")}>{busy.startsWith("category-") ? "Salvando..." : "Salvar categoria"}</button></div></section>
    </div>}

    {productDraft && productMode && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) { setProductDraft(null); setProductMode(null); } }}>
      <section className={styles.editor}>
        <div className={styles.editorHead}><div><span>{productMode === "create" ? "NOVO PRODUTO" : "EDITAR PRODUTO"}</span><h3>{productMode === "create" ? "Cadastrar item" : productDraft.name}</h3></div><button onClick={() => { setProductDraft(null); setProductMode(null); }}>×</button></div>
        {productMode === "edit" && <div className={styles.idBox}><span>ID permanente</span><strong>{productDraft.id}</strong></div>}
        <div className={styles.form}>
          <label className={styles.full}>Nome<input value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} placeholder="Ex.: Burger Mineirin" /></label>
          <label className={styles.full}>Descrição curta<textarea value={productDraft.description} onChange={(e) => setProductDraft({ ...productDraft, description: e.target.value })} placeholder="Texto curto para o card" /></label>
          <label className={styles.full}>Título dos detalhes<input value={productDraft.detailsTitle} onChange={(e) => setProductDraft({ ...productDraft, detailsTitle: e.target.value })} placeholder="Ex.: O que vem no Uai?" /></label>
          <label className={styles.full}>Ingredientes / composição<textarea value={productDraft.detailsItems} onChange={(e) => setProductDraft({ ...productDraft, detailsItems: e.target.value })} placeholder={"Um item por linha\nPão\nHambúrguer\nBacon"} /></label>
          <label className={styles.full}>Acompanha<textarea value={productDraft.includedExtras} onChange={(e) => setProductDraft({ ...productDraft, includedExtras: e.target.value })} placeholder="Maionese temperada da casa, molho verde e ketchup sachê" /></label>
          <div className={`${styles.full} ${styles.bundleEditor}`}>
            <div className={styles.bundleEditorHead}><div><strong>Composição por produtos</strong><small>Ideal para combos e promoções. Ingredientes vêm do cadastro do lanche vinculado.</small></div><button type="button" onClick={() => { const candidate=products.find((item)=>item.id!==productDraft.id); if(candidate)setProductDraft({...productDraft,bundleItems:[...productDraft.bundleItems,{productId:candidate.id,quantity:1,note:""}]}); }}>+ Adicionar item</button></div>
            {productDraft.bundleItems.length ? <div className={styles.bundleRows}>{productDraft.bundleItems.map((item,index)=><div className={styles.bundleRow} key={`${item.productId}-${index}`}>
              <select value={item.productId} onChange={(e)=>{const next=[...productDraft.bundleItems];next[index]={...next[index],productId:e.target.value};setProductDraft({...productDraft,bundleItems:next});}}>{products.filter((candidate)=>candidate.id!==productDraft.id).map((candidate)=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>
              <input aria-label="Quantidade" type="number" min="1" value={item.quantity} onChange={(e)=>{const next=[...productDraft.bundleItems];next[index]={...next[index],quantity:Math.max(1,Number(e.target.value)||1)};setProductDraft({...productDraft,bundleItems:next});}} />
              <input aria-label="Observação do item" value={item.note} placeholder="Ex.: Brinde" onChange={(e)=>{const next=[...productDraft.bundleItems];next[index]={...next[index],note:e.target.value};setProductDraft({...productDraft,bundleItems:next});}} />
              <button type="button" aria-label="Remover item" onClick={()=>setProductDraft({...productDraft,bundleItems:productDraft.bundleItems.filter((_,i)=>i!==index)})}>×</button>
            </div>)}</div> : <p className={styles.bundleEmpty}>Sem vínculos. O formato antigo em texto continua compatível.</p>}
          </div>
          <div className={`${styles.full} ${styles.commercialBlock}`}>
            <div className={styles.commercialHead}><div><span>PREÇO & PROMOÇÃO</span><strong>Venda do produto</strong></div>{promoMetrics(productDraft.price, productDraft.oldPrice) ? <b>OFERTA ATIVA</b> : <small>Preço anterior é opcional</small>}</div>
            <div className={styles.priceFields}>
              <label>Preço atual<div className={styles.moneyInput}><span>R$</span><input inputMode="decimal" value={productDraft.price} onChange={(e) => setProductDraft({ ...productDraft, price: e.target.value })} onBlur={(e) => setProductDraft({ ...productDraft, price: moneyDraft(e.target.value) })} placeholder="0,00" /></div></label>
              <label>Preço anterior<div className={styles.moneyInput}><span>R$</span><input inputMode="decimal" value={productDraft.oldPrice} onChange={(e) => setProductDraft({ ...productDraft, oldPrice: e.target.value })} onBlur={(e) => setProductDraft({ ...productDraft, oldPrice: moneyDraft(e.target.value) })} placeholder="0,00" /></div></label>
            </div>
            {(() => { const promo=promoMetrics(productDraft.price,productDraft.oldPrice); return promo ? <div className={styles.promoPreview}><div><span>CLIENTE ECONOMIZA</span><strong>{money(promo.saving)}</strong></div><b>-{promo.percent}%</b><small>De {money(promo.oldPrice)} por {money(promo.price)}</small></div> : <p className={styles.promoHint}>Informe um preço anterior maior que o atual para ativar a apresentação promocional no cardápio.</p>; })()}
          </div>
          <div className={styles.photoUpload}><label className={styles.photoButton}>{uploadingImage ? "Enviando..." : "Escolher foto do celular"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage} onChange={(e)=>{const file=e.target.files?.[0];if(file)void uploadProductImage(file);e.currentTarget.value="";}} /></label><small>JPG, PNG ou WebP · até 6 MB. O campo de URL continua funcionando.</small></div>
          <div className={styles.formChoice}><ChoicePicker label="Categoria" value={productDraft.category} onChange={(category) => setProductDraft({ ...productDraft, category })} options={categoryOptions} /></div>
          <label>Ordem<input inputMode="numeric" value={productDraft.sortOrder} onChange={(e) => setProductDraft({ ...productDraft, sortOrder: e.target.value })} placeholder="Opcional" /></label>
          <label className={styles.full}>Imagem / caminho<input value={productDraft.image} onChange={(e) => setProductDraft({ ...productDraft, image: e.target.value })} placeholder="/img/produto.png ou URL https://..." /></label>
        </div>
        {productDraft.image.trim() && <div className={styles.preview}><img src={productDraft.image} alt="" /><div><span>PRÉVIA</span><strong>{productDraft.name || "Novo produto"}</strong><small>{productDraft.image}</small></div></div>}
        <div className={styles.switches}>
          <button type="button" data-on={productDraft.disponivel} onClick={() => setProductDraft({ ...productDraft, disponivel: !productDraft.disponivel })}><i />Disponível</button>
          <button type="button" data-on={productDraft.isSuggestion} onClick={() => setProductDraft({ ...productDraft, isSuggestion: !productDraft.isSuggestion })}><i />Sugestão da casa</button>
          <button type="button" data-on={productDraft.showInOffers} onClick={() => setProductDraft({ ...productDraft, showInOffers: !productDraft.showInOffers })}><i />Exibir em Ofertas da Família</button>
        </div>
        {productDraft.category !== "bebidas" && <div className={styles.addonPicker}>
          <div className={styles.addonPickerHead}><div><strong>Adicionais permitidos</strong><span>{productDraft.addonIds === undefined ? "Todos os adicionais ativos" : `${productDraft.addonIds.length} selecionados`}</span></div><button type="button" onClick={() => setProductDraft({ ...productDraft, addonIds: undefined })}>Permitir todos</button></div>
          <div className={styles.checks}>{addons.map((addon) => { const checked = productDraft.addonIds === undefined || productDraft.addonIds.includes(addon.id); return <label key={addon.id}><input type="checkbox" checked={checked} onChange={() => { const base = productDraft.addonIds === undefined ? addons.map((item) => item.id) : productDraft.addonIds; setProductDraft({ ...productDraft, addonIds: checked ? base.filter((id) => id !== addon.id) : [...base, addon.id] }); }} /><span>{addon.name}</span><small>{money(addon.price)}</small></label>; })}</div>
        </div>}
        <div className={styles.editorActions}><button onClick={() => { setProductDraft(null); setProductMode(null); }}>Cancelar</button><button className={styles.save} onClick={saveProduct} disabled={busy.startsWith("product-")}>{busy.startsWith("product-") ? "Salvando..." : productMode === "create" ? "Criar produto" : "Salvar alterações"}</button></div>
      </section>
    </div>}

    {addonDraft && addonMode && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) { setAddonDraft(null); setAddonMode(null); } }}>
      <section className={styles.smallEditor}>
        <div className={styles.editorHead}><div><span>{addonMode === "create" ? "NOVO ADICIONAL" : "EDITAR ADICIONAL"}</span><h3>{addonMode === "create" ? "Cadastrar adicional" : addonDraft.name}</h3></div><button onClick={() => { setAddonDraft(null); setAddonMode(null); }}>×</button></div>
        {addonMode === "edit" && <div className={styles.idBox}><span>ID permanente</span><strong>{addonDraft.id}</strong></div>}
        <label>Nome<input value={addonDraft.name} onChange={(e) => setAddonDraft({ ...addonDraft, name: e.target.value })} /></label>
        <label>Preço<div className={styles.moneyInput}><span>R$</span><input inputMode="decimal" value={addonDraft.price} onChange={(e) => setAddonDraft({ ...addonDraft, price: e.target.value })} onBlur={(e) => setAddonDraft({ ...addonDraft, price: moneyDraft(e.target.value) })} placeholder="0,00" /></div></label>
        <label>Ordem<input inputMode="numeric" value={addonDraft.sortOrder} onChange={(e) => setAddonDraft({ ...addonDraft, sortOrder: e.target.value })} placeholder="Opcional" /></label>
        <button className={styles.availability} data-on={addonDraft.disponivel} onClick={() => setAddonDraft({ ...addonDraft, disponivel: !addonDraft.disponivel })}><i />{addonDraft.disponivel ? "Disponível" : "Pausado"}</button>
        <div className={styles.editorActions}><button onClick={() => { setAddonDraft(null); setAddonMode(null); }}>Cancelar</button><button className={styles.save} onClick={saveAddon} disabled={busy.startsWith("addon-")}>{busy.startsWith("addon-") ? "Salvando..." : addonMode === "create" ? "Criar adicional" : "Salvar alterações"}</button></div>
      </section>
    </div>}
  </div>;
}
