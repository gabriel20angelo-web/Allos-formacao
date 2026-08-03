// Área de eventos como rota própria.
//
// Existe para o cargo "eventos" (migration 041): quem cuida dos eventos entra
// aqui e não vê nada do resto do painel. O admin continua alcançando a mesma
// aba dentro do Calendário — é o mesmo componente, sem duplicação de código.

"use client";

import { motion } from "framer-motion";
import { CalendarDays, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import EventosTab from "@/components/admin/calendario/EventosTab";

export default function EventosPage() {
  const { canManageEvents, loading } = useAuth();

  if (loading) {
    return (
      <p className="text-sm text-cream/30 font-dm py-12 text-center">
        Carregando...
      </p>
    );
  }

  if (!canManageEvents) {
    return (
      <div className="text-center py-20">
        <Shield className="h-12 w-12 text-cream/20 mx-auto mb-4" />
        <h2 className="font-fraunces font-bold text-xl text-cream mb-2">
          Acesso restrito
        </h2>
        <p className="text-cream/40 font-dm text-sm">
          Esta área é de quem administra os eventos.
        </p>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2.5">
          <CalendarDays className="h-5 w-5" style={{ color: "#C84B31" }} />
          <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
            Eventos
          </h1>
        </div>
        <p className="text-sm text-cream/35 mt-1 font-dm">
          Crie e gerencie os eventos que aparecem no calendário público da
          formação.
        </p>
      </motion.div>

      <EventosTab />
    </div>
  );
}
