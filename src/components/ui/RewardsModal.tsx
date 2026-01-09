"use client";

import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function RewardsModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  // --- CONFIGURAÇÃO DAS METAS (Pode editar aqui) ---
  const goals = [
    { target: 5, title: "Nível Bronze", reward: "10% OFF", cupom: "BRONZE10", icon: "🥉", color: "#CD7F32" },
    { target: 10, title: "Nível Prata", reward: "Coca-Cola Grátis", cupom: "PRATACOCA", icon: "🥈", color: "#C0C0C0" },
    { target: 20, title: "Nível Ouro", reward: "Burger Grátis", cupom: "OUROBURGER", icon: "🥇", color: "#FFD700" },
    { target: 50, title: "Nível Diamante", reward: "Combo Família", cupom: "DIAMANTE", icon: "💎", color: "#b9f2ff" },
  ];

  useEffect(() => {
    async function fetchPoints() {
      if (!currentUser) return;
      try {
        const docRef = doc(db, "Usuarios", currentUser.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setPoints(snap.data().pedidosFeitos || 0);
        }
      } catch (error) {
        console.error("Erro ao buscar pontos", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPoints();
  }, [currentUser]);

  // Calcula qual é a próxima meta
  const nextGoal = goals.find(g => g.target > points) || goals[goals.length - 1];
  const progress = Math.min(100, (points / nextGoal.target) * 100);

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Cupom ${code} copiado!`);
    closeModal();
  };

  return (
    <ModalBase title="Programa de Fidelidade 💎" onClose={closeModal}>
      <div style={{ padding: "20px" }}>
        
        {/* Cabeçalho de Pontos */}
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <div style={{ fontSize: "14px", color: "#666" }}>Você possui</div>
            <div style={{ fontSize: "48px", fontWeight: "900", color: "#e65100", lineHeight: "1" }}>{points}</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#e65100" }}>PONTOS</div>
        </div>

        {/* Barra de Progresso Principal */}
        {points < nextGoal.target && (
            <div style={{ marginBottom: "30px", background: "#f5f5f5", padding: "15px", borderRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "13px", fontWeight: "600" }}>
                    <span>Progresso para {nextGoal.title}</span>
                    <span>{points}/{nextGoal.target}</span>
                </div>
                <div style={{ width: "100%", height: "10px", background: "#e0e0e0", borderRadius: "5px", overflow: "hidden" }}>
                    <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #ffca28, #fb8c00)", transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "5px", textAlign: "center" }}>
                    Faltam apenas {nextGoal.target - points} pedidos para ganhar: <b>{nextGoal.reward}</b>
                </div>
            </div>
        )}

        {/* Lista de Conquistas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ fontSize: "16px", margin: "0 0 10px 0" }}>Suas Conquistas</h3>
            
            {goals.map((goal) => {
                const isUnlocked = points >= goal.target;
                
                return (
                    <div key={goal.target} style={{ 
                        display: "flex", alignItems: "center", gap: "15px", 
                        padding: "12px", borderRadius: "12px", 
                        border: isUnlocked ? `2px solid ${goal.color}` : "1px solid #eee",
                        background: isUnlocked ? "#fff" : "#fcfcfc",
                        opacity: isUnlocked ? 1 : 0.6
                    }}>
                        <div style={{ fontSize: "32px" }}>{goal.icon}</div>
                        
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "bold", color: "#333" }}>{goal.title}</div>
                            <div style={{ fontSize: "12px", color: "#666" }}>Recompensa: {goal.reward}</div>
                            {!isUnlocked && <div style={{ fontSize: "10px", color: "#999" }}>Desbloqueia com {goal.target} pontos</div>}
                        </div>

                        {isUnlocked ? (
                            <button 
                                onClick={() => copyCoupon(goal.cupom)}
                                style={{ background: goal.color, color: "#fff", border: "none", padding: "8px 12px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
                            >
                                PEGAR CUPOM
                            </button>
                        ) : (
                            <div style={{ fontSize: "20px" }}>🔒</div>
                        )}
                    </div>
                );
            })}
        </div>

      </div>
    </ModalBase>
  );
}