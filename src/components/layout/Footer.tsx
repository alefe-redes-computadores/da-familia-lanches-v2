"use client";

import { useUIStore } from "@/store/ui";

export function Footer() {
  const openModal = useUIStore((s) => s.openModal);
  const currentYear = new Date().getFullYear();

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        
        {/* 1. Marca e Slogan */}
        <div style={{ marginBottom: "30px" }}>
          <h3 style={styles.brand}>DA FAMÍLIA LANCHES</h3>
          <p style={styles.slogan}>Aqui o sabor é de casa 🏡</p>
        </div>

        {/* 2. Botões de Redes Sociais */}
        <div style={styles.socialGrid}>
          
          {/* WHATSAPP */}
          <a 
            href="https://wa.me/5534997178336" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ ...styles.socialBtn, background: "#25D366", color: "#fff" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            <span>WhatsApp</span>
          </a>

          {/* INSTAGRAM */}
          <a 
            href="https://www.instagram.com/dafamilia_patos?igsh=MTdxdDczNno4ZHRrZw==" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ ...styles.socialBtn, background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", color: "#fff" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            <span>Instagram</span>
          </a>

          {/* IFOOD */}
          <a 
            href="https://www.ifood.com.br/delivery/patos-de-minas-mg/da-familia-lanches-caramuru/9aadff75-b014-4e7f-a9b4-b3e478e38af8?UTM_Medium=share" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ ...styles.socialBtn, background: "#EA1D2C", color: "#fff" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 13.5c0 2.485-2.015 4.5-4.5 4.5s-4.5-2.015-4.5-4.5 2.015-4.5 4.5-4.5 4.5 2.015 4.5 4.5zm2.5 0c0 3.866-3.134 7-7 7s-7-3.134-7-7 3.134-7 7-7 7 3.134 7 7zm6.604 1.808a.501.501 0 00.396-.498v-3.62a.5.5 0 00-.5-.5H22V8.5a.5.5 0 00-.5-.5h-2.152l-2.613-3.667a.5.5 0 00-.735-.084l-2.071 1.542a.5.5 0 00-.115.688l2.057 3.021h-2.316l-3.21-4.708a.5.5 0 00-.735-.084L7.541 6.167a.5.5 0 00-.115.688l3.141 4.611A9.44 9.44 0 001.5 13.5C1.5 18.747 5.753 23 11 23s9.5-4.253 9.5-9.5c0-.168-.009-.335-.021-.5h3.021a.5.5 0 00.5-.5v-1.192a.5.5 0 00.104-.008z"/></svg>
            <span>Pedir no iFood</span>
          </a>

        </div>

        {/* 3. Endereço (Clicável) */}
        <div style={{ marginBottom: "20px" }}>
            <a 
                href="https://www.google.com/maps/search/?api=1&query=Da+Família+Lanches+Patos+de+Minas"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#aaa", textDecoration: "none", fontSize: "13px", lineHeight: "1.6" }}
            >
                <p style={{ margin: 0 }}>📍 Rua dos Caiçaras, 212 - Caramuru</p>
                <p style={{ margin: 0 }}>Patos de Minas - MG</p>
            </a>
        </div>

        {/* 4. Rodapé Legal */}
        <div style={styles.legal}>
          <p>© 2026 Da Família Lanches. Todos os direitos reservados.</p>
          <div style={styles.links}>
            <button onClick={() => openModal("terms")} style={styles.linkBtn}>Termos de Uso</button>
            <span>•</span>
            <button onClick={() => openModal("terms")} style={styles.linkBtn}>Privacidade</button>
          </div>
        </div>

      </div>
    </footer>
  );
}

const styles = {
  footer: {
    background: "#111",
    color: "#fff",
    padding: "40px 20px 80px 20px",
    borderTop: "4px solid #ffca28",
    textAlign: "center" as const,
    marginTop: "auto",
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
  },
  brand: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
    color: "#ffca28",
  },
  slogan: {
    margin: "5px 0 0",
    opacity: 0.7,
    fontSize: "13px",
    fontWeight: 500,
  },
  socialGrid: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap" as const,
    marginBottom: "30px",
  },
  socialBtn: {
    padding: "12px 24px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "transform 0.2s",
    boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
  },
  legal: {
    borderTop: "1px solid #333",
    paddingTop: "20px",
    fontSize: "12px",
    color: "#888",
  },
  links: {
    marginTop: "10px",
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    alignItems: "center",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#aaa",
    cursor: "pointer",
    fontSize: "12px",
    textDecoration: "underline",
  }
};