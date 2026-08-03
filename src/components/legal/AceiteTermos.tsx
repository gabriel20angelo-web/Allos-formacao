// Registra o aceite dos Termos de Uso de quem já está logado (cláusula 3).
//
// O texto do aceite aparece na tela de cadastro; o que falta é a prova, e é
// isso que este componente garante. Roda uma vez por navegador e por versão:
// a marca no localStorage evita bater na rota a cada navegação, e a constraint
// única no banco protege contra registro duplicado quando ela não existir.

"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { VERSAO_TERMOS } from "@/lib/legal/versoes";

const VERSAO = VERSAO_TERMOS;

export default function AceiteTermos() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    const chave = `allos_termos_${VERSAO}_${user.id}`;
    try {
      if (window.localStorage.getItem(chave)) return;
    } catch {
      // navegador sem localStorage: segue e deixa o banco decidir
    }

    let cancelado = false;
    fetch("/formacao/api/aceite-termos", {
      method: "POST",
      credentials: "include",
    })
      .then((res) => {
        if (!cancelado && res.ok) {
          try {
            window.localStorage.setItem(chave, new Date().toISOString());
          } catch {
            /* idem */
          }
        }
      })
      .catch(() => {
        // sem rede agora: tenta de novo na próxima visita
      });

    return () => {
      cancelado = true;
    };
  }, [user, loading]);

  return null;
}
