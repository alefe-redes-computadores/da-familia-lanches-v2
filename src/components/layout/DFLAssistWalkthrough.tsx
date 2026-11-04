"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, HelpCircle, MapPin, Search, ShoppingBasket } from "lucide-react";
import { businessWhatsAppUrl } from "@/lib/businessContact";
import styles from "./DFLAssist.module.css";

const tourSteps = [
  {
    title: "Encontre algo gostoso",
    body: "Procure pelo nome ou ingrediente, escolha quantas pessoas vão comer e informe quanto pretende gastar. As sugestões vêm do nosso cardápio disponível.",
    example: "Ex.: quero um combo para 3 pessoas até R$ 60",
    icon: Search,
  },
  {
    title: "Escolha e personalize",
    body: "Abra o produto para conferir os ingredientes. Se houver opções de adicionais ou remoções disponíveis, faça suas escolhas e ajuste a quantidade antes de colocar no carrinho.",
    example: "Confira cada item antes de continuar.",
    icon: ShoppingBasket,
  },
  {
    title: "Informe como vai receber",
    body: "No carrinho, toque em Continuar para finalizar. Escolha entrega ou retirada e preencha nome e WhatsApp. Para entrega, confira bairro, rua e número.",
    example: "O CEP pode ajudar, mas não é obrigatório.",
    icon: MapPin,
  },
  {
    title: "Revise e confirme uma vez",
    body: "Confira os itens, a taxa, eventuais descontos e o total. Escolha como pagar e confirme o pedido. Se a resposta demorar, consulte Meus Pedidos antes de tentar outra vez.",
    example: "Uma confirmação incerta não significa que o pedido falhou.",
    icon: ClipboardCheck,
  },
  {
    title: "Se precisar, estamos aqui",
    body: "Você pode voltar ao assistente quando quiser ou falar diretamente com a equipe. O WhatsApp é atendimento; abrir a conversa não envia seu carrinho nem confirma uma compra.",
    example: "A equipe pode ajudar se alguma etapa estiver difícil.",
    icon: HelpCircle,
  },
] as const;

export function DFLAssistWalkthrough({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [step, setStep] = useState(0);
  const current = tourSteps[step];
  const Icon = current.icon;
  const last = step === tourSteps.length - 1;

  return (
    <section className={styles.tour} aria-label="Apresentação do DFL Assist" aria-live="polite">
      <div className={styles.tourTop}>
        <span className={styles.tourEyebrow}>GUIA RÁPIDO · {step + 1} DE {tourSteps.length}</span>
        <button type="button" className={styles.tourSkip} onClick={onSkip}>Pular apresentação</button>
      </div>
      <div className={styles.tourProgress} aria-label={`Etapa ${step + 1} de ${tourSteps.length}`}>
        {tourSteps.map((item, index) => <span key={item.title} data-current={index === step} data-complete={index < step} />)}
      </div>
      <div className={styles.tourHero}>
        <span className={styles.tourIcon}><Icon size={27} strokeWidth={1.8} aria-hidden="true" /></span>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <small>{current.example}</small>
      </div>
      {last && (
        <a className={styles.tourWhatsApp} href={businessWhatsAppUrl("Olá! Preciso de ajuda para realizar um pedido no site da Da Família Lanches.")} target="_blank" rel="noopener noreferrer">
          Falar com a nossa equipe
        </a>
      )}
      <div className={styles.tourActions}>
        {step > 0 ? (
          <button type="button" className={styles.tourBack} onClick={() => setStep(value => value - 1)}><ArrowLeft size={17}/> Voltar</button>
        ) : <span aria-hidden="true" />}
        <button type="button" className={styles.tourNext} onClick={() => last ? onDone() : setStep(value => value + 1)}>
          {last ? <><CheckCircle2 size={18}/> Explorar o cardápio</> : <>Avançar <ArrowRight size={18}/></>}
        </button>
      </div>
      <p className={styles.tourLegal}>Este guia explica o processo. Nenhum pedido é criado durante a apresentação.</p>
    </section>
  );
}
