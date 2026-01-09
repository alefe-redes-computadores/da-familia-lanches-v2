"use client";

import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";

export function TermsModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const currentYear = new Date().getFullYear();

  return (
    <ModalBase title="Política de Privacidade 🔒" onClose={closeModal}>
      <div style={{ padding: "20px", fontSize: "14px", lineHeight: "1.6", color: "#333" }}>
        <p style={{ marginBottom: "15px", fontStyle: "italic", color: "#666" }}>
          Última atualização: {new Date().toLocaleDateString()}
        </p>

        <section style={{ marginBottom: "20px" }}>
          <h3 style={headingStyle}>1. Introdução</h3>
          <p>A Da Família Lanches valoriza sua privacidade. Esta política explica como coletamos, utilizamos, protegemos e compartilhamos seus dados pessoais ao usar nosso site e serviços.</p>
        </section>

        <section style={{ marginBottom: "20px" }}>
          <h3 style={headingStyle}>2. Dados coletados</h3>
          <ul style={{ paddingLeft: "20px", margin: "10px 0" }}>
            <li>Informações fornecidas pelo usuário: nome, e-mail, telefone e endereço.</li>
            <li>Dados de pedidos: itens escolhidos, valores, quantidades e horários.</li>
            <li>Dados técnicos: IP, tipo de navegador e cookies de sessão.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "20px" }}>
          <h3 style={headingStyle}>3. Finalidade do uso</h3>
          <ul style={{ paddingLeft: "20px", margin: "10px 0" }}>
            <li>Processar e entregar seus pedidos.</li>
            <li>Manter histórico e facilitar compras futuras.</li>
            <li>Melhorar a experiência e personalizar promoções.</li>
            <li>Cumprir obrigações legais e fiscais.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "20px" }}>
          <h3 style={headingStyle}>4. Compartilhamento</h3>
          <p>Não vendemos seus dados. Compartilhamos apenas com:</p>
          <ul style={{ paddingLeft: "20px", margin: "10px 0" }}>
            <li>Parceiros de pagamento e logística (para a entrega acontecer).</li>
            <li>Serviços de tecnologia (Firebase/Google) para armazenamento seguro.</li>
            <li>Autoridades competentes, se exigido por lei.</li>
          </ul>
        </section>

        <section style={{ marginBottom: "20px" }}>
          <h3 style={headingStyle}>5. Cookies</h3>
          <p>Usamos cookies para lembrar seu carrinho e manter seu login ativo. Você pode desativar no navegador, mas o site pode não funcionar corretamente.</p>
        </section>

        <section style={{ marginBottom: "20px" }}>
          <h3 style={headingStyle}>6. Seus Direitos (LGPD)</h3>
          <p>Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento entrando em contato conosco.</p>
        </section>

        <div style={{ marginTop: "30px", borderTop: "1px solid #eee", paddingTop: "20px", textAlign: "center", fontSize: "12px", color: "#888" }}>
          <p>Dúvidas? Envie e-mail para <strong>contato@dafamilialanches.com.br</strong></p>
          <p>© {currentYear} Da Família Lanches</p>
        </div>
        
        <button 
          onClick={closeModal}
          style={{
            width: "100%",
            marginTop: "20px",
            background: "#111",
            color: "#fff",
            border: "none",
            padding: "12px",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Entendi e Concordo
        </button>
      </div>
    </ModalBase>
  );
}

const headingStyle = {
  color: "#111",
  borderLeft: "4px solid #ffca28",
  paddingLeft: "10px",
  fontWeight: "800",
  fontSize: "16px",
  marginBottom: "8px"
};