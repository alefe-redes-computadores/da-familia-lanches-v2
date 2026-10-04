"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { Pencil, Pause, Play, Plus, Save, Search, Trash2, X, TicketPercent } from "lucide-react";
import { db } from "@/lib/firebase";
import { normalizeCoupon, type CouponDiscountType, type StoreCoupon } from "@/lib/coupons";
import { haptic } from "@/lib/haptics";
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

const emptyEditor = (): Editor => ({
  originalCode: "", code: "", description: "", active: true, type: "fixed",
  value: "", minOrder: "0,00", startsAt: "", expiresAt: "",
});

const localDateValue = (timestamp: Timestamp | null) => {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toTimestamp = (value: string) => value ? Timestamp.fromMillis(new Date(value).getTime()) : null;

const numberValue = (value: string, fallback = 0) => {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyText = (value: number | string) =>
  numberValue(String(value), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const moneyTyping = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return digits
    ? (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";
};

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
    return term
      ? coupons.filter((coupon) => coupon.code.toLowerCase().includes(term) || coupon.description.toLowerCase().includes(term))
      : coupons;
  }, [coupons, search]);

  const editCoupon = (coupon: StoreCoupon) => {
    haptic("step");
    setEditor({
      originalCode: coupon.code,
      code: coupon.code,
      description: coupon.description,
      active: coupon.active,
      type: coupon.type,
      value: coupon.type === "fixed" ? moneyText(coupon.value) : String(coupon.value),
      minOrder: moneyText(coupon.minOrder),
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

      const wasEditing = Boolean(editor.originalCode);
      setEditor(emptyEditor());
      setEditorOpen(false);
      setFeedback(wasEditing ? "Cupom atualizado." : "Cupom criado.");
      haptic("success");
    } catch (error) {
      console.error(error);
      setFeedback("Não foi possível salvar o cupom.");
      haptic("error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (coupon: StoreCoupon) => {
    haptic("step");
    try {
      await setDoc(doc(db, "Cupons", coupon.code), { ativo: !coupon.active, updatedAt: serverTimestamp() }, { merge: true });
      haptic("success");
    } catch (error) {
      console.error(error);
      setFeedback("Não foi possível alterar o cupom.");
      haptic("error");
    }
  };

  const remove = async (coupon: StoreCoupon) => {
    if (confirmDelete !== coupon.code) {
      setConfirmDelete(coupon.code);
      setFeedback(`Toque novamente em excluir ${coupon.code} para confirmar.`);
      haptic("step");
      return;
    }

    try {
      await deleteDoc(doc(db, "Cupons", coupon.code));
      setConfirmDelete("");
      setFeedback("Cupom excluído. Pedidos antigos continuam preservando o código utilizado.");
      if (editor.originalCode === coupon.code) setEditor(emptyEditor());
      haptic("success");
    } catch (error) {
      console.error(error);
      setFeedback("Não foi possível excluir o cupom.");
      haptic("error");
    }
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.editor} data-open={editorOpen || Boolean(editor.originalCode)}>
        <div className={styles.editorHeader}>
          <div>
            <span>{editor.originalCode ? "EDITANDO" : "CUPONS"}</span>
            <strong><TicketPercent size={17}/>{editor.originalCode || "Nova campanha"}</strong>
          </div>
          <button type="button" onClick={() => {
            haptic("step");
            if (editorOpen || editor.originalCode) {
              setEditor(emptyEditor());
              setEditorOpen(false);
            } else setEditorOpen(true);
          }}>
            {editorOpen || editor.originalCode ? <><X size={14}/>Fechar</> : <><Plus size={14}/>Criar cupom</>}
          </button>
        </div>

        <div className={styles.editorBody}>
          <div className={styles.grid}>
            <label><span>Código</span><input value={editor.code} disabled={Boolean(editor.originalCode)} placeholder="EX: FAMILIA10" onChange={(event) => setEditor((state) => ({ ...state, code: event.target.value.toUpperCase() }))} /></label>
            <label><span>Tipo</span><select value={editor.type} onChange={(event) => setEditor((state) => ({ ...state, type: event.target.value as CouponDiscountType }))}><option value="fixed">Valor em R$</option><option value="percent">Porcentagem</option></select></label>
            <label><span>{editor.type === "percent" ? "Desconto (%)" : "Desconto (R$)"}</span><input inputMode="decimal" value={editor.value} onChange={(event) => setEditor((state) => ({ ...state, value: state.type === "fixed" ? moneyTyping(event.target.value) : event.target.value.replace(/[^\d,.]/g, "") }))} onBlur={() => editor.type === "fixed" && setEditor((state) => ({ ...state, value: moneyText(state.value) }))} /></label>
            <label><span>Pedido mínimo (R$)</span><input inputMode="decimal" value={editor.minOrder} onChange={(event) => setEditor((state) => ({ ...state, minOrder: moneyTyping(event.target.value) }))} onBlur={() => setEditor((state) => ({ ...state, minOrder: moneyText(state.minOrder) }))} /></label>
            <label><span>Começa em</span><input type="datetime-local" value={editor.startsAt} onChange={(event) => setEditor((state) => ({ ...state, startsAt: event.target.value }))} /></label>
            <label><span>Termina em</span><input type="datetime-local" value={editor.expiresAt} onChange={(event) => setEditor((state) => ({ ...state, expiresAt: event.target.value }))} /></label>
          </div>

          <label className={styles.full}><span>Descrição</span><textarea rows={2} value={editor.description} onChange={(event) => setEditor((state) => ({ ...state, description: event.target.value }))} /></label>

          <label className={styles.switchRow}>
            <div><strong>Cupom ativo</strong><span>Desative sem apagar a configuração.</span></div>
            <input type="checkbox" checked={editor.active} onChange={(event) => { haptic("step"); setEditor((state) => ({ ...state, active: event.target.checked })); }} />
          </label>

          {feedback && <div className={styles.feedback}>{feedback}</div>}

          <button className={styles.primary} type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando…" : <><Save size={15}/>{editor.originalCode ? "Salvar alterações" : "Criar cupom"}</>}
          </button>
        </div>
      </section>

      <section className={styles.listCard}>
        <div className={styles.listHeader}>
          <div><span>CUPONS CADASTRADOS</span><strong>{coupons.length} no total</strong></div>
          {(searchOpen || search)
            ? <label className={styles.searchBox}><Search size={15}/><input autoFocus placeholder="Buscar código ou descrição" value={search} onChange={(event) => setSearch(event.target.value)} onBlur={() => !search && setSearchOpen(false)} /></label>
            : <button type="button" className={styles.searchTrigger} onClick={() => { haptic("step"); setSearchOpen(true); }}><Search size={14}/>Buscar</button>}
        </div>

        <div className={styles.list}>
          {filtered.length === 0
            ? <div className={styles.empty}>Nenhum cupom encontrado.</div>
            : filtered.map((coupon) => {
              const expired = Boolean(coupon.expiresAt && coupon.expiresAt.toMillis() < Date.now());
              const scheduled = Boolean(coupon.startsAt && coupon.startsAt.toMillis() > Date.now());
              const status = !coupon.active ? "Pausado" : expired ? "Expirado" : scheduled ? "Agendado" : "Ativo";

              return <article className={styles.coupon} key={coupon.code}>
                <div className={styles.couponTop}>
                  <div><span>{status}</span><strong>{coupon.code}</strong><p>{coupon.description || "Sem descrição"}</p></div>
                  <b>{coupon.type === "percent" ? `${coupon.value}% OFF` : `${money(coupon.value)} OFF`}</b>
                </div>

                <div className={styles.meta}>
                  <span>Pedido mínimo: {coupon.minOrder > 0 ? money(coupon.minOrder) : "sem mínimo"}</span>
                  <span>Início: {coupon.startsAt ? coupon.startsAt.toDate().toLocaleString("pt-BR") : "imediato"}</span>
                  <span>Fim: {coupon.expiresAt ? coupon.expiresAt.toDate().toLocaleString("pt-BR") : "sem validade"}</span>
                </div>

                <div className={styles.actions}>
                  <button type="button" onClick={() => editCoupon(coupon)}><Pencil size={14}/>Editar</button>
                  <button type="button" onClick={() => void toggle(coupon)}>{coupon.active ? <><Pause size={14}/>Pausar</> : <><Play size={14}/>Reativar</>}</button>
                  <button type="button" data-danger="true" onClick={() => void remove(coupon)}>{confirmDelete === coupon.code ? "Confirmar exclusão" : <><Trash2 size={14}/>Excluir</>}</button>
                </div>
              </article>;
            })}
        </div>
      </section>
    </div>
  );
}
