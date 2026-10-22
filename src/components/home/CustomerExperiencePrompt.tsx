"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { markExperienceAnswered, markExperienceShown, shouldAskExperience } from "@/lib/customerExperience";
import { readGuestOrders } from "@/lib/guestContinuity";

export function CustomerExperiencePrompt() {
  const [id, setId] = useState("");
  const [count, setCount] = useState(0);
  const [bad, setBad] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    const orders = readGuestOrders();
    setCount(orders.length);
    const first = orders[0];
    if (first && shouldAskExperience(first.id)) {
      setId(first.id);
      markExperienceShown();
    }
  }, []);

  const question = useMemo(() =>
    count <= 1 ? "Como foi fazer seu pedido?" :
    count === 2 ? "Ficou mais rápido pedir novamente?" :
    "Como está sua experiência com o nosso site?", [count]);

  async function send(rating: string) {
    if (!id || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch("/api/experience-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: id, rating, reason: reason || null,
          comment: comment.trim() || null, question,
          experienceVersion: "v56.2", journeyStage: "post_order",
          localOrderCount: count, customerMode: "guest",
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`feedback_http_${response.status}`);
      markExperienceAnswered(id);
      setDone(true);
    } catch {
      // Mantem avaliacao e campos editaveis para uma nova tentativa segura.
      setError("Não foi possível enviar agora. Sua sugestão está preservada para tentar novamente.");
    } finally {
      window.clearTimeout(timeout);
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!id || done) return null;
  return (
    <section className="dfl-cx" aria-label="Pesquisa de experiência">
      <small>SUA EXPERIÊNCIA</small>
      <strong>{question}</strong>
      {!bad ? (
        <div>
          <button type="button" disabled={busy} onClick={() => void send("muito_facil")}>😍 Muito fácil</button>
          <button type="button" disabled={busy} onClick={() => void send("tranquilo")}>🙂 Tranquilo</button>
          <button type="button" disabled={busy} onClick={() => setBad(true)}>😕 Pode melhorar</button>
        </div>
      ) : (
        <>
          <span>O que poderíamos melhorar?</span>
          <div>{["Encontrar produtos", "Carrinho", "Endereço", "Agendamento", "Pagamento", "Outro"].map((option) => (
            <button type="button" key={option} disabled={busy} data-active={reason === option} onClick={() => setReason(option)}>{option}</button>
          ))}</div>
          <textarea value={comment} disabled={busy} maxLength={500} onChange={(event) => setComment(event.target.value)} placeholder="Quer contar mais? (opcional)" />
          <button type="button" disabled={!reason || busy} onClick={() => void send("melhorar")}>{busy ? "Enviando…" : "Enviar sugestão"}</button>
        </>
      )}
      {error && <p role="alert" style={{ color: "#b42318", fontSize: 13, lineHeight: 1.5 }}>{error}</p>}
      {busy && <span role="status">Enviando sua avaliação…</span>}
    </section>
  );
}
