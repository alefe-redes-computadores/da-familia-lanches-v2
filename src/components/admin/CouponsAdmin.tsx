"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeCoupon, type CouponDiscountType, type StoreCoupon } from "@/lib/coupons";
import styles from "./CouponsAdmin.module.css";

type Editor = {
  originalCode: string;
  code: string;
  description: string;
  active: boolean;
  type: CouponDiscountType;
  value: string;
  minOrder: string;
  startsAt: string;
  expiresAt: string;
};

const emptyEditor = (): Editor => ({ originalCode: "", code: "", description: "", active: true, type: "fixed", value: "", minOrder: "0", startsAt: "", expiresAt: "" });
const localDateValue = (timestamp: Timestamp | null) => {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const toTimestamp = (value: string) => value ? Timestamp.fromMillis(new Date(value).getTime()) : null;
const numberValue = (value: string, fallback = 0) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CouponsAdmin() {
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => onSnapshot(collection(db, "Cupons"), (snapshot) => {
    setCoupons(snapshot.docs.map((item) => normalizeCoupon(item.id, item.data())).sort((a, b) => a.code.localeCompare(b.code, "pt-BR")));
  }, (error) => {
    console.error(error);
    setFeedback("Não foi possível carregar os cupons.");
  }), []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? coupons.filter((coupon) => coupon.code.toLowerCase().includes(term) || coupon.description.toLowerCase().includes(term)) : coupons;
  }, [coupons, search]);

  const editCoupon = (coupon: StoreCoupon) => {
    setEditor({
      originalCode: coupon.code,
      code: coupon.code,
      description: coupon.description,
      active: coupon.active,
      type: coupon.type,
      value: String(coupon.value),
      minOrder: String(coupon.minOrder),
      startsAt: localDateValue(coupon.startsAt),
      expiresAt: localDateValue(coupon.expiresAt),
    });
    setFeedback("");
    setConfirmDelete("");
    setEditorOpen(true);
  };

  const save = async () => {
    const code = editor.code.replace(/[^a-z0-9_-]/gi, "").toUpperCase().slice(0, 32);
    const value = numberValue(editor.value, 0);
    const minOrder = Math.max(0, numberValue(editor.minOrder, 0));
    const startsAt = toTimestamp(editor.startsAt);
    const expiresAt = toTimestamp(editor.expiresAt);

    if (!code) return setFeedback("Informe um código para o cupom.");
    if (value <= 0) return setFeedback("Informe um desconto maior que zero.");
    if (editor.type === "percent" && value > 100) return setFeedback("Cupom percentual não pode passar de 100%.");
    if (startsAt && expiresAt && expiresAt.toMillis() <= startsAt.toMillis()) return setFeedback("A validade precisa terminar depois do início.");
    if (editor.originalCode && editor.originalCode !== code) return setFeedback("O código é permanente. Para trocar, crie outro cupom.");

    setSaving(true);
    setFeedback("");
    try {
      await setDoc(doc(db, "Cupons", code), {
        ativo: editor.active,
        tipo: editor.type,
        valor: value,
        minOrder,
        startsAt,
        expiresAt,
        description: editor.description.trim(),
        updatedAt: serverTimestamp(),
        ...(editor.originalCode ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });
      setEditor(emptyEditor());
      setEditorOpen(false);
      setFeedback(editor.originalCode ? "Cupom atualizado." : "Cupom criado.");
    } catch (error) {
      console.error(error);
      setFeedback("Não foi possível salvar o cupom.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (coupon: StoreCoupon) => {
    await setDoc(doc(db, "Cupons", coupon.code), { ativo: !coupon.active, updatedAt: serverTimestamp() }, { merge: true });
  };

  const remove = async (coupon: StoreCoupon) => {
    if (confirmDelete !== coupon.code) {
      setConfirmDelete(coupon.code);
      setFeedback(`Toque novamente em excluir ${coupon.code} para confirmar.`);
      return;
    }
    await deleteDoc(doc(db, "Cupons", coupon.code));
    setConfirmDelete("");
    setFeedback("Cupom excluído. Pedidos antigos continuam preservando o código utilizado.");
    if (editor.originalCode === coupon.code) setEditor(emptyEditor());
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.editor} data-open={editorOpen || Boolean(editor.originalCode)}>
        <div className={styles.editorHeader}><div><span>{editor.originalCode ? "EDITANDO" : "CUPONS"}</span><strong>{editor.originalCode || "Nova campanha"}</strong></div><button type="button" onClick={() => { if (editorOpen || editor.originalCode) { setEditor(emptyEditor()); setEditorOpen(false); } else setEditorOpen(true); }}>{editorOpen || editor.originalCode ? "Fechar" : "+ Criar cupom"}</button></div>
        <div className={styles.editorBody}>
        <div className={styles.grid}>
          <label><span>Código</span><input value={editor.code} disabled={Boolean(editor.originalCode)} placeholder="EX: FAMILIA10" onChange={(event) => setEditor((state) => ({ ...state, code: event.target.value.toUpperCase() }))} /></label>
          <label><span>Tipo</span><select value={editor.type} onChange={(event) => setEditor((state) => ({ ...state, type: event.target.value as CouponDiscountType }))}><option value="fixed">Valor em R$</option><option value="percent">Porcentagem</option></select></label>
          <label><span>{editor.type === "percent" ? "Desconto (%)" : "Desconto (R$)"}</span><input inputMode="decimal" value={editor.value} onChange={(event) => setEditor((state) => ({ ...state, value: event.target.value }))} /></label>
          <label><span>Pedido mínimo (R$)</span><input inputMode="decimal" value={editor.minOrder} onChange={(event) => setEditor((state) => ({ ...state, minOrder: event.target.value }))} /></label>
          <label><span>Começa em</span><input type="datetime-local" value={editor.startsAt} onChange={(event) => setEditor((state) => ({ ...state, startsAt: event.target.value }))} /></label>
          <label><span>Termina em</span><input type="datetime-local" value={editor.expiresAt} onChange={(event) => setEditor((state) => ({ ...state, expiresAt: event.target.value }))} /></label>
        </div>
        <label className={styles.full}><span>Descrição</span><textarea rows={2} value={editor.description} onChange={(event) => setEditor((state) => ({ ...state, description: event.target.value }))} /></label>
        <label className={styles.switchRow}><div><strong>Cupom ativo</strong><span>Desative sem apagar a configuração.</span></div><input type="checkbox" checked={editor.active} onChange={(event) => setEditor((state) => ({ ...state, active: event.target.checked }))} /></label>
        {feedback && <div className={styles.feedback}>{feedback}</div>}
        <button className={styles.primary} type="button" disabled={saving} onClick={() => void save()}>{saving ? "Salvando…" : editor.originalCode ? "Salvar alterações" : "Criar cupom"}</button>
        </div>
      </section>

      <section className={styles.listCard}>
        <div className={styles.listHeader}><div><span>CUPONS CADASTRADOS</span><strong>{coupons.length} no total</strong></div>{(searchOpen || search) ? <input autoFocus placeholder="Buscar código ou descrição" value={search} onChange={(event) => setSearch(event.target.value)} onBlur={()=>!search&&setSearchOpen(false)} /> : <button type="button" className={styles.searchTrigger} onClick={()=>setSearchOpen(true)}>⌕ Buscar</button>}</div>
        <div className={styles.list}>
          {filtered.length === 0 ? <div className={styles.empty}>Nenhum cupom encontrado.</div> : filtered.map((coupon) => {
            const expired = Boolean(coupon.expiresAt && coupon.expiresAt.toMillis() < Date.now());
            const scheduled = Boolean(coupon.startsAt && coupon.startsAt.toMillis() > Date.now());
            const status = !coupon.active ? "Pausado" : expired ? "Expirado" : scheduled ? "Agendado" : "Ativo";
            return <article className={styles.coupon} key={coupon.code}>
              <div className={styles.couponTop}><div><span>{status}</span><strong>{coupon.code}</strong><p>{coupon.description || "Sem descrição"}</p></div><b>{coupon.type === "percent" ? `${coupon.value}% OFF` : `${money(coupon.value)} OFF`}</b></div>
              <div className={styles.meta}><span>Pedido mínimo: {coupon.minOrder > 0 ? money(coupon.minOrder) : "sem mínimo"}</span><span>Início: {coupon.startsAt ? coupon.startsAt.toDate().toLocaleString("pt-BR") : "imediato"}</span><span>Fim: {coupon.expiresAt ? coupon.expiresAt.toDate().toLocaleString("pt-BR") : "sem validade"}</span></div>
              <div className={styles.actions}><button type="button" onClick={() => editCoupon(coupon)}>Editar</button><button type="button" onClick={() => void toggle(coupon)}>{coupon.active ? "Pausar" : "Reativar"}</button><button type="button" data-danger="true" onClick={() => void remove(coupon)}>{confirmDelete === coupon.code ? "Confirmar exclusão" : "Excluir"}</button></div>
            </article>;
          })}
        </div>
      </section>
    </div>
  );
}
