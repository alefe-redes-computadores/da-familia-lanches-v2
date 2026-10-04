"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { Pencil, Pause, Play, Plus, RefreshCw, Save, Search, Trash2, X, TicketPercent } from "lucide-react";
import { db } from "@/lib/firebase";
import { normalizeCoupon, type CouponDiscountType, type StoreCoupon } from "@/lib/coupons";
import { adminMoneyBRL, adminMoneyText, adminMoneyTyping, adminPercentText, parseAdminMoney } from "@/lib/admin-money";
import { haptic } from "@/lib/haptics";
import { useAdminConfirm, useAdminFeedback } from "@/components/admin/ui/AdminExperienceProvider";
import { AdminLoadingState } from "@/components/admin/ui/AdminState";
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
  originalCode: "",
  code: "",
  description: "",
  active: true,
  type: "fixed",
  value: "",
  minOrder: "0,00",
  startsAt: "",
  expiresAt: "",
});

const localDateValue = (timestamp: Timestamp | null) => {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toTimestamp = (value: string) =>
  value ? Timestamp.fromMillis(new Date(value).getTime()) : null;

const sortCoupons = (items: StoreCoupon[]) =>
  [...items].sort((a, b) => a.code.localeCompare(b.code, "pt-BR"));

export function CouponsAdmin() {
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { show } = useAdminFeedback();
  const confirm = useAdminConfirm();

  const load = useCallback(async (manual = false) => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "Cupons"));
      setCoupons(sortCoupons(snapshot.docs.map((item) => normalizeCoupon(item.id, item.data()))));
      if (manual) {
        show({
          tone: "success",
          title: "Cupons atualizados",
          message: "A lista foi recarregada sob demanda.",
          key: "coupons-load",
        });
      }
    } catch (error) {
      console.error("[admin/coupons/load]", error);
      show({
        tone: "error",
        title: "Não foi possível carregar os cupons",
        message: "Tente recarregar a lista.",
        key: "coupons-load",
        actionLabel: "Tentar novamente",
        onAction: () => void load(true),
      });
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? coupons.filter(
          (coupon) =>
            coupon.code.toLowerCase().includes(term) ||
            coupon.description.toLowerCase().includes(term),
        )
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
      value:
        coupon.type === "fixed"
          ? adminMoneyText(coupon.value)
          : String(coupon.value),
      minOrder: adminMoneyText(coupon.minOrder),
      startsAt: localDateValue(coupon.startsAt),
      expiresAt: localDateValue(coupon.expiresAt),
    });
    setEditorOpen(true);
  };

  const save = async () => {
    const code = editor.code
      .replace(/[^a-z0-9_-]/gi, "")
      .toUpperCase()
      .slice(0, 32);

    const value = parseAdminMoney(editor.value, 0);
    const minOrder = Math.max(0, parseAdminMoney(editor.minOrder, 0));
    const startsAt = toTimestamp(editor.startsAt);
    const expiresAt = toTimestamp(editor.expiresAt);

    if (!code) {
      show({ tone: "error", title: "Código obrigatório", message: "Informe um código para o cupom.", key: "coupon-editor" });
      return;
    }
    if (value <= 0) {
      show({ tone: "error", title: "Desconto inválido", message: "Informe um desconto maior que zero.", key: "coupon-editor" });
      return;
    }
    if (editor.type === "percent" && value > 100) {
      show({ tone: "error", title: "Porcentagem inválida", message: "Cupom percentual não pode passar de 100%.", key: "coupon-editor" });
      return;
    }
    if (startsAt && expiresAt && expiresAt.toMillis() <= startsAt.toMillis()) {
      show({ tone: "error", title: "Validade inválida", message: "O término precisa ficar depois do início.", key: "coupon-editor" });
      return;
    }
    if (editor.originalCode && editor.originalCode !== code) {
      show({ tone: "info", title: "Código permanente", message: "Para trocar o código, crie outro cupom.", key: "coupon-editor" });
      return;
    }

    setSaving(true);
    show({
      tone: "progress",
      title: "Salvando cupom",
      message: code,
      key: "coupon-save",
    });

    try {
      await setDoc(
        doc(db, "Cupons", code),
        {
          ativo: editor.active,
          tipo: editor.type,
          valor: value,
          minOrder,
          startsAt,
          expiresAt,
          description: editor.description.trim(),
          updatedAt: serverTimestamp(),
          ...(editor.originalCode ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );

      const next: StoreCoupon = {
        code,
        active: editor.active,
        type: editor.type,
        value,
        minOrder,
        startsAt,
        expiresAt,
        description: editor.description.trim(),
      };

      setCoupons((current) =>
        sortCoupons([
          ...current.filter((coupon) => coupon.code !== code),
          next,
        ]),
      );

      const editing = Boolean(editor.originalCode);
      setEditor(emptyEditor());
      setEditorOpen(false);

      show({
        tone: "success",
        title: editing ? "Cupom atualizado" : "Cupom criado",
        message: `${code} já está refletido na lista local.`,
        key: "coupon-save",
      });
    } catch (error) {
      console.error("[admin/coupons/save]", error);
      show({
        tone: "error",
        title: "Não foi possível salvar o cupom",
        message: "Nada foi removido. Tente novamente.",
        key: "coupon-save",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (coupon: StoreCoupon) => {
    if (saving) return;
    const nextActive = !coupon.active;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "Cupons", coupon.code),
        { ativo: nextActive, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setCoupons((current) =>
        current.map((item) =>
          item.code === coupon.code ? { ...item, active: nextActive } : item,
        ),
      );
      show({
        tone: "success",
        title: nextActive ? "Cupom reativado" : "Cupom pausado",
        message: coupon.code,
        key: `coupon-${coupon.code}`,
      });
    } catch (error) {
      console.error("[admin/coupons/toggle]", error);
      show({
        tone: "error",
        title: "Não foi possível alterar o cupom",
        message: coupon.code,
        key: `coupon-${coupon.code}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (coupon: StoreCoupon) => {
    if (saving) return;
    const approved = await confirm({
      title: `Excluir ${coupon.code}?`,
      message:
        "Pedidos antigos continuam preservando o código utilizado. Esta ação remove apenas o cadastro atual.",
      confirmLabel: "Excluir cupom",
      tone: "danger",
    });
    if (!approved) return;

    setSaving(true);
    try {
      await deleteDoc(doc(db, "Cupons", coupon.code));
      setCoupons((current) =>
        current.filter((item) => item.code !== coupon.code),
      );
      if (editor.originalCode === coupon.code) {
        setEditor(emptyEditor());
        setEditorOpen(false);
      }
      show({
        tone: "success",
        title: "Cupom excluído",
        message: `${coupon.code} foi removido.`,
        key: `coupon-${coupon.code}`,
      });
    } catch (error) {
      console.error("[admin/coupons/delete]", error);
      show({
        tone: "error",
        title: "Não foi possível excluir o cupom",
        message: coupon.code,
        key: `coupon-${coupon.code}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap} data-admin-module="coupons">
      <section className={styles.editor} data-open={editorOpen || Boolean(editor.originalCode)}>
        <div className={styles.editorHeader}>
          <div>
            <span>{editor.originalCode ? "EDITANDO" : "CUPONS"}</span>
            <strong><TicketPercent size={17}/>{editor.originalCode || "Nova campanha"}</strong>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic("step");
              if (editorOpen || editor.originalCode) {
                setEditor(emptyEditor());
                setEditorOpen(false);
              } else {
                setEditorOpen(true);
              }
            }}
          >
            {editorOpen || editor.originalCode
              ? <><X size={14}/>Fechar</>
              : <><Plus size={14}/>Criar cupom</>}
          </button>
        </div>

        <div className={styles.editorBody}>
          <div className={styles.grid}>
            <label>
              <span>Código</span>
              <input
                value={editor.code}
                disabled={Boolean(editor.originalCode)}
                placeholder="EX: FAMILIA10"
                onChange={(event) =>
                  setEditor((state) => ({
                    ...state,
                    code: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>

            <label>
              <span>Tipo</span>
              <select
                value={editor.type}
                onChange={(event) =>
                  setEditor((state) => ({
                    ...state,
                    type: event.target.value as CouponDiscountType,
                  }))
                }
              >
                <option value="fixed">Valor em R$</option>
                <option value="percent">Porcentagem</option>
              </select>
            </label>

            <label>
              <span>{editor.type === "percent" ? "Desconto (%)" : "Desconto (R$)"}</span>
              <input
                inputMode="decimal"
                value={editor.value}
                onChange={(event) =>
                  setEditor((state) => ({
                    ...state,
                    value:
                      state.type === "fixed"
                        ? adminMoneyTyping(event.target.value)
                        : adminPercentText(event.target.value),
                  }))
                }
                onBlur={() =>
                  editor.type === "fixed" &&
                  setEditor((state) => ({
                    ...state,
                    value: adminMoneyText(state.value),
                  }))
                }
              />
            </label>

            <label>
              <span>Pedido mínimo (R$)</span>
              <input
                inputMode="decimal"
                value={editor.minOrder}
                onChange={(event) =>
                  setEditor((state) => ({
                    ...state,
                    minOrder: adminMoneyTyping(event.target.value),
                  }))
                }
                onBlur={() =>
                  setEditor((state) => ({
                    ...state,
                    minOrder: adminMoneyText(state.minOrder),
                  }))
                }
              />
            </label>

            <label>
              <span>Começa em</span>
              <input
                type="datetime-local"
                value={editor.startsAt}
                onChange={(event) =>
                  setEditor((state) => ({
                    ...state,
                    startsAt: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Termina em</span>
              <input
                type="datetime-local"
                value={editor.expiresAt}
                onChange={(event) =>
                  setEditor((state) => ({
                    ...state,
                    expiresAt: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <label className={styles.full}>
            <span>Descrição</span>
            <textarea
              rows={2}
              value={editor.description}
              onChange={(event) =>
                setEditor((state) => ({
                  ...state,
                  description: event.target.value,
                }))
              }
            />
          </label>

          <label className={styles.switchRow}>
            <div>
              <strong>Cupom ativo</strong>
              <span>Desative sem apagar a configuração.</span>
            </div>
            <input
              type="checkbox"
              checked={editor.active}
              onChange={(event) => {
                haptic("step");
                setEditor((state) => ({
                  ...state,
                  active: event.target.checked,
                }));
              }}
            />
          </label>

          <button
            className={styles.primary}
            type="button"
            data-admin-action="primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving
              ? "Salvando…"
              : <><Save size={15}/>{editor.originalCode ? "Salvar alterações" : "Criar cupom"}</>}
          </button>
        </div>
      </section>

      <section className={styles.listCard}>
        <div className={styles.listHeader}>
          <div>
            <span>CUPONS CADASTRADOS</span>
            <strong>{coupons.length} no total</strong>
          </div>

          <div className={styles.headerActions}>
            {(searchOpen || search)
              ? <label className={styles.searchBox}>
                  <Search size={15}/>
                  <input
                    autoFocus
                    placeholder="Buscar código ou descrição"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onBlur={() => !search && setSearchOpen(false)}
                  />
                </label>
              : <button
                  type="button"
                  className={styles.searchTrigger}
                  onClick={() => {
                    haptic("step");
                    setSearchOpen(true);
                  }}
                >
                  <Search size={14}/>Buscar
                </button>}

            <button
              type="button"
              className={styles.reload}
              disabled={loading}
              onClick={() => void load(true)}
            >
              <RefreshCw size={14}/>Recarregar
            </button>
          </div>
        </div>

        {loading
          ? <AdminLoadingState label="Carregando cupons" compact />
          : <div className={styles.list}>
              {filtered.length === 0
                ? <div className={styles.empty}>Nenhum cupom encontrado.</div>
                : filtered.map((coupon) => {
                    const expired = Boolean(
                      coupon.expiresAt &&
                      coupon.expiresAt.toMillis() < Date.now(),
                    );
                    const scheduled = Boolean(
                      coupon.startsAt &&
                      coupon.startsAt.toMillis() > Date.now(),
                    );
                    const status = !coupon.active
                      ? "Pausado"
                      : expired
                        ? "Expirado"
                        : scheduled
                          ? "Agendado"
                          : "Ativo";

                    return (
                      <article className={styles.coupon} key={coupon.code}>
                        <div className={styles.couponTop}>
                          <div>
                            <span>{status}</span>
                            <strong>{coupon.code}</strong>
                            <p>{coupon.description || "Sem descrição"}</p>
                          </div>
                          <b>
                            {coupon.type === "percent"
                              ? `${coupon.value}% OFF`
                              : `${adminMoneyBRL(coupon.value)} OFF`}
                          </b>
                        </div>

                        <div className={styles.meta}>
                          <span>
                            Pedido mínimo:{" "}
                            {coupon.minOrder > 0
                              ? adminMoneyBRL(coupon.minOrder)
                              : "sem mínimo"}
                          </span>
                          <span>
                            Início:{" "}
                            {coupon.startsAt
                              ? coupon.startsAt.toDate().toLocaleString("pt-BR")
                              : "imediato"}
                          </span>
                          <span>
                            Fim:{" "}
                            {coupon.expiresAt
                              ? coupon.expiresAt.toDate().toLocaleString("pt-BR")
                              : "sem validade"}
                          </span>
                        </div>

                        <div className={styles.actions}>
                          <button
                            type="button"
                            onClick={() => editCoupon(coupon)}
                          >
                            <Pencil size={14}/>Editar
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void toggle(coupon)}
                          >
                            {coupon.active
                              ? <><Pause size={14}/>Pausar</>
                              : <><Play size={14}/>Reativar</>}
                          </button>
                          <button
                            type="button"
                            data-admin-action="danger"
                            disabled={saving}
                            onClick={() => void remove(coupon)}
                          >
                            <Trash2 size={14}/>Excluir
                          </button>
                        </div>
                      </article>
                    );
                  })}
            </div>}
      </section>
    </div>
  );
}
