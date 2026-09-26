"use client";

import { useEffect, useMemo, useState } from "react";
import { readFirestoreBudget, resetFirestoreBudget, subscribeFirestoreBudget, type FirestoreBudgetSnapshot } from "@/lib/firestoreReadBudget";

const blank = (): FirestoreBudgetSnapshot => ({ totalDocuments: 0, totalEvents: 0, startedAt: Date.now(), entries: [] });

export function FirestoreBudgetAdmin() {
  const [snapshot, setSnapshot] = useState<FirestoreBudgetSnapshot>(() => typeof window === "undefined" ? blank() : readFirestoreBudget());
  useEffect(() => subscribeFirestoreBudget(setSnapshot), []);
  const top = useMemo(() => snapshot.entries.slice(0, 6), [snapshot.entries]);
  const hours = Math.max((Date.now() - snapshot.startedAt) / 3_600_000, 1 / 60);
  const perHour = Math.round(snapshot.totalDocuments / hours);

  return (
    <section className="firestoreBudget">
      <div className="firestoreBudgetHead">
        <div><span>DIAGNÓSTICO LOCAL</span><strong>Pressão de leituras Firestore</strong><p>Estimativa desta sessão neste aparelho. O billing oficial continua sendo o painel Firebase.</p></div>
        <div className="firestoreBudgetTotal"><b>{snapshot.totalDocuments}</b><small>docs estimados</small></div>
      </div>
      <div className="firestoreBudgetMeta"><span>{snapshot.totalEvents} eventos</span><span>≈ {perHour}/hora</span></div>
      {top.length ? <div className="firestoreBudgetList">{top.map((entry) => <div key={entry.source}><span>{entry.source}</span><b>{entry.documents}</b><small>{entry.events} eventos</small></div>)}</div> : <div className="firestoreBudgetEmpty">Ainda não houve leitura instrumentada nesta sessão.</div>}
      <div className="firestoreBudgetActions">
        <button type="button" onClick={() => setSnapshot(readFirestoreBudget())}>Atualizar</button>
        <button type="button" onClick={() => { resetFirestoreBudget(); setSnapshot(readFirestoreBudget()); }}>Zerar sessão</button>
      </div>
    </section>
  );
}
