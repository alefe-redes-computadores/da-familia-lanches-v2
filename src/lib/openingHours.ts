// Lógica de Horário de Funcionamento OFICIAL 🕒

export function getShopStatus() {
    const now = new Date();
    // Força o horário de Brasília
    const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    
    const day = brTime.getDay(); // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
    const hour = brTime.getHours();
    const minutes = brTime.getMinutes();
    
    // Converte o horário atual para um número decimal para facilitar a conta
    // Ex: 22:45 vira 22.75 | 23:15 vira 23.25
    const currentTime = hour + (minutes / 60);

    let isOpen = false;
    let nextOpen = "Abre às 18:00";

    switch (day) {
        case 1: // Segunda
        case 3: // Quarta
        case 4: // Quinta
            if (currentTime >= 18 && currentTime < 22.75) isOpen = true;
            break;

        case 5: // Sexta
        case 6: // Sábado
        case 0: // Domingo
            if (currentTime >= 18 && currentTime < 23.25) isOpen = true;
            break;

        case 2: // Terça
            isOpen = false;
            nextOpen = "Fechado hoje (Abre amanhã às 18:00)";
            break;
    }

    return { 
        isOpen, 
        message: isOpen ? "Aberto agora" : `Fechado • ${nextOpen}` 
    };
}