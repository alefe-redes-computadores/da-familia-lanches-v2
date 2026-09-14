"use client";

import { useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { products as fallbackProducts, type Product, type ProductCategory } from "@/data/products";
import { ADDONS as fallbackAddons, type Addon } from "@/data/addons";
import { useCatalog } from "@/hooks/useCatalog";
import { CATALOG_ADDONS_COLLECTION, CATALOG_PRODUCTS_COLLECTION } from "@/lib/catalog";
import styles from "./CatalogAdmin.module.css";

const CATEGORIES: Array<{ value: ProductCategory; label: string }> = [
  { value: "promocoes", label: "Promoções" },
  { value: "combos", label: "Combos" },
  { value: "tradicionais", label: "Tradicionais" },
  { value: "artesanais", label: "Artesanais" },
  { value: "hotdogs", label: "Hot dogs" },
  { value: "bebidas", label: "Bebidas" },
];

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
  sortOrder: string;
  addonIds?: string[];
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
  sortOrder: product.sortOrder == null ? "" : String(product.sortOrder),
  addonIds: product.addonIds,
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

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      if (categoryFilter !== "all" && product.category !== categoryFilter) return false;
      if (availabilityFilter === "active" && !product.disponivel) return false;
      if (availabilityFilter === "paused" && product.disponivel) return false;
      if (!term) return true;
      return product.name.toLocaleLowerCase("pt-BR").includes(term) || product.description.toLocaleLowerCase("pt-BR").includes(term) || product.id.toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [products, search, categoryFilter, availabilityFilter]);

  const activeProducts = products.filter((product) => product.disponivel).length;
  const pausedProducts = products.length - activeProducts;
  const activeAddons = allAddons.filter((addon) => addon.disponivel !== false).length;

  const openCreateProduct = () => {
    setProductMode("create");
    setProductDraft({ id: "", name: "", description: "", price: "", oldPrice: "", image: "", category: "tradicionais", disponivel: true, isSuggestion: false, sortOrder: "", addonIds: undefined });
    setMessage("");
  };

  const openEditProduct = (product: Product) => {
    setProductMode("edit");
    setProductDraft(draftFromProduct(product));
    setMessage("");
  };

  const saveProduct = async () => {
    if (!productDraft || !productMode) return;
    const price = Number(productDraft.price.replace(",", "."));
    const oldPrice = productDraft.oldPrice.trim() ? Number(productDraft.oldPrice.replace(",", ".")) : null;
    const sortOrder = productDraft.sortOrder.trim() ? Number(productDraft.sortOrder) : null;

    if (!productDraft.name.trim()) return setMessage("Informe o nome do produto.");
    if (!productDraft.description.trim()) return setMessage("Informe a descrição do produto.");
    if (!productDraft.image.trim()) return setMessage("Informe a imagem ou caminho do produto.");
    if (!Number.isFinite(price) || price < 0) return setMessage("Informe um preço válido.");
    if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) return setMessage("Preço anterior inválido.");

    const usedIds = new Set(products.map((product) => product.id));
    const id = productMode === "edit" ? productDraft.id : nextId(productDraft.name, usedIds);

    setBusy(`product-${id}`);
    try {
      const payload: Record<string, unknown> = {
        id,
        name: productDraft.name.trim(),
        description: productDraft.description.trim(),
        price,
        oldPrice,
        image: productDraft.image.trim(),
        category: productDraft.category,
        disponivel: productDraft.disponivel,
        isSuggestion: productDraft.isSuggestion,
        sortOrder: sortOrder !== null && Number.isFinite(sortOrder) ? sortOrder : null,
        updatedAt: serverTimestamp(),
      };

      if (productDraft.category === "bebidas") payload.addonIds = [];
      else payload.addonIds = productDraft.addonIds ?? null;

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
        oldPrice: product.oldPrice ?? null, image: product.image, category: product.category,
        disponivel: !product.disponivel, isSuggestion: Boolean(product.isSuggestion),
        sortOrder: product.sortOrder ?? null, addonIds: product.addonIds ?? null, updatedAt: serverTimestamp(),
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
    const price = Number(addonDraft.price.replace(",", "."));
    const sortOrder = addonDraft.sortOrder.trim() ? Number(addonDraft.sortOrder) : null;
    if (!addonDraft.name.trim()) return setMessage("Informe o nome do adicional.");
    if (!Number.isFinite(price) || price < 0) return setMessage("Informe um preço válido para o adicional.");

    const usedIds = new Set(allAddons.map((addon) => addon.id));
    const id = addonMode === "edit" ? addonDraft.id : nextId(addonDraft.name, usedIds);

    setBusy(`addon-${id}`);
    try {
      await setDoc(doc(db, CATALOG_ADDONS_COLLECTION, id), {
        id,
        name: addonDraft.name.trim(),
        price,
        disponivel: addonDraft.disponivel,
        sortOrder: sortOrder !== null && Number.isFinite(sortOrder) ? sortOrder : null,
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

  if (loading) return <div className={styles.state}>Carregando catálogo...</div>;

  return <div className={styles.root}>
    <section className={styles.summary}>
      <div className={styles.summaryCopy}>
        <span>FONTE ATUAL</span>
        <strong>{source === "hybrid" ? "Catálogo remoto operacional" : "Fallback local ativo"}</strong>
        <p>{remoteProducts} produtos e {remoteAddons} adicionais com versão remota.</p>
      </div>
      <div className={styles.summaryActions}>
        <button className={styles.secondaryAction} onClick={openCreateAddon}>+ Adicional</button>
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
        ...CATEGORIES,
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

    <div className={styles.products}>
      {filteredProducts.map((product) => <article className={styles.product} key={product.id} data-off={!product.disponivel}>
        <img src={product.image} alt="" />
        <div className={styles.productInfo}>
          <div className={styles.productTitle}>
            <div><strong>{product.name}</strong><span>{CATEGORIES.find((category) => category.value === product.category)?.label} · {product.id}</span></div>
            {product.isSuggestion && <b>Sugestão</b>}
          </div>
          <p>{product.description}</p>
          <div className={styles.productBottom}><strong>{money(product.price)}</strong><span data-active={product.disponivel}>{product.disponivel ? "Disponível" : "Pausado"}</span></div>
        </div>
        <div className={styles.actions}>
          <button onClick={() => toggleProduct(product)} disabled={busy === `toggle-${product.id}`}>{product.disponivel ? "Pausar" : "Reativar"}</button>
          <button className={styles.primary} onClick={() => openEditProduct(product)}>Editar</button>
        </div>
      </article>)}
      {!filteredProducts.length && <div className={styles.empty}><strong>Nenhum produto encontrado</strong><span>Altere os filtros ou crie um novo produto.</span></div>}
    </div>

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
      <div><span>MANUTENÇÃO</span><strong>Fallback local</strong><p>Reaplica os itens-base do código no Firestore sem remover produtos ou adicionais criados pelo Admin.</p></div>
      <button data-confirm={confirmSeed} onClick={seedCatalog} disabled={busy === "seed"}>{busy === "seed" ? "Sincronizando..." : confirmSeed ? "Confirmar sincronização" : "Sincronizar catálogo-base"}</button>
      {confirmSeed && <button className={styles.cancelSeed} onClick={() => setConfirmSeed(false)}>Cancelar</button>}
    </section>

    {productDraft && productMode && <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) { setProductDraft(null); setProductMode(null); } }}>
      <section className={styles.editor}>
        <div className={styles.editorHead}><div><span>{productMode === "create" ? "NOVO PRODUTO" : "EDITAR PRODUTO"}</span><h3>{productMode === "create" ? "Cadastrar item" : productDraft.name}</h3></div><button onClick={() => { setProductDraft(null); setProductMode(null); }}>×</button></div>
        {productMode === "edit" && <div className={styles.idBox}><span>ID permanente</span><strong>{productDraft.id}</strong></div>}
        <div className={styles.form}>
          <label className={styles.full}>Nome<input value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} placeholder="Ex.: Burger Mineirin" /></label>
          <label className={styles.full}>Descrição<textarea value={productDraft.description} onChange={(e) => setProductDraft({ ...productDraft, description: e.target.value })} placeholder="Ingredientes e descrição comercial" /></label>
          <label>Preço<input inputMode="decimal" value={productDraft.price} onChange={(e) => setProductDraft({ ...productDraft, price: e.target.value })} placeholder="0,00" /></label>
          <label>Preço anterior<input inputMode="decimal" value={productDraft.oldPrice} onChange={(e) => setProductDraft({ ...productDraft, oldPrice: e.target.value })} placeholder="Opcional" /></label>
          <div className={styles.formChoice}><ChoicePicker label="Categoria" value={productDraft.category} onChange={(category) => setProductDraft({ ...productDraft, category })} options={CATEGORIES} /></div>
          <label>Ordem<input inputMode="numeric" value={productDraft.sortOrder} onChange={(e) => setProductDraft({ ...productDraft, sortOrder: e.target.value })} placeholder="Opcional" /></label>
          <label className={styles.full}>Imagem / caminho<input value={productDraft.image} onChange={(e) => setProductDraft({ ...productDraft, image: e.target.value })} placeholder="/img/produto.png ou URL https://..." /></label>
        </div>
        {productDraft.image.trim() && <div className={styles.preview}><img src={productDraft.image} alt="" /><div><span>PRÉVIA</span><strong>{productDraft.name || "Novo produto"}</strong><small>{productDraft.image}</small></div></div>}
        <div className={styles.switches}>
          <button type="button" data-on={productDraft.disponivel} onClick={() => setProductDraft({ ...productDraft, disponivel: !productDraft.disponivel })}><i />Disponível</button>
          <button type="button" data-on={productDraft.isSuggestion} onClick={() => setProductDraft({ ...productDraft, isSuggestion: !productDraft.isSuggestion })}><i />Sugestão da casa</button>
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
        <label>Preço<input inputMode="decimal" value={addonDraft.price} onChange={(e) => setAddonDraft({ ...addonDraft, price: e.target.value })} /></label>
        <label>Ordem<input inputMode="numeric" value={addonDraft.sortOrder} onChange={(e) => setAddonDraft({ ...addonDraft, sortOrder: e.target.value })} placeholder="Opcional" /></label>
        <button className={styles.availability} data-on={addonDraft.disponivel} onClick={() => setAddonDraft({ ...addonDraft, disponivel: !addonDraft.disponivel })}><i />{addonDraft.disponivel ? "Disponível" : "Pausado"}</button>
        <div className={styles.editorActions}><button onClick={() => { setAddonDraft(null); setAddonMode(null); }}>Cancelar</button><button className={styles.save} onClick={saveAddon} disabled={busy.startsWith("addon-")}>{busy.startsWith("addon-") ? "Salvando..." : addonMode === "create" ? "Criar adicional" : "Salvar alterações"}</button></div>
      </section>
    </div>}
  </div>;
}
