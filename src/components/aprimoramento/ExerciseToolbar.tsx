"use client";

import { Star, Check, Clock as ClockIcon, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAprimoramentoEstados } from "@/hooks/useAprimoramentoEstados";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  slug: string;
  /** Cor da categoria — usada nos active states. */
  color: string;
  tint: string;
  border: string;
}

export default function ExerciseToolbar({ slug, color, tint, border }: Props) {
  const { user } = useAuth();
  const { states, toggleStatus, markDone, loading } = useAprimoramentoEstados(
    user?.id ?? null,
  );

  const state = states.get(slug);
  const isFav = state?.status === "favorito";
  const isDepois = state?.status === "fazer-depois";
  const isFeito = state?.status === "feito";
  const doneCount = state?.done_count ?? 0;
  const lastDone = state?.last_done_at;

  const onFav = async () => {
    await toggleStatus(slug, "favorito");
    toast.success(isFav ? "Removido dos favoritos" : "Favoritado");
  };
  const onDepois = async () => {
    await toggleStatus(slug, "fazer-depois");
    toast.success(isDepois ? "Tirado da lista de depois" : "Adicionado a 'fazer depois'");
  };
  const onFeito = async () => {
    await markDone(slug);
    const novoCount = doneCount + 1;
    toast.success(
      novoCount === 1
        ? "Marcado como feito"
        : `Feito ${novoCount}× — bem vindo de volta`,
    );
  };

  // Quando o useAuth ainda não carregou, render disabled placeholders.
  const disabled = !user?.id || loading;

  return (
    <div className="my-6 print-hide" data-print="hide">
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton
          onClick={onFav}
          active={isFav}
          color={color}
          tint={tint}
          border={border}
          disabled={disabled}
          icon={
            <Star
              width={13}
              height={13}
              aria-hidden="true"
              fill={isFav ? color : "none"}
            />
          }
          label={isFav ? "Favorito" : "Favoritar"}
        />
        <ToolbarButton
          onClick={onFeito}
          active={isFeito}
          color={color}
          tint={tint}
          border={border}
          disabled={disabled}
          icon={
            doneCount > 0 ? (
              <Repeat2 width={13} height={13} aria-hidden="true" />
            ) : (
              <Check width={13} height={13} aria-hidden="true" />
            )
          }
          label={
            doneCount === 0
              ? "Marcar como feito"
              : doneCount === 1
                ? "Refazer"
                : `Feito ${doneCount}× — refazer`
          }
        />
        <ToolbarButton
          onClick={onDepois}
          active={isDepois}
          color={color}
          tint={tint}
          border={border}
          disabled={disabled}
          icon={<ClockIcon width={13} height={13} aria-hidden="true" />}
          label={isDepois ? "Para depois" : "Fazer depois"}
        />
      </div>

      {/* Status secundário */}
      {lastDone && (
        <p className="font-dm text-[11px] text-cream/45 mt-2 ml-0.5">
          Última vez{" "}
          <time
            dateTime={lastDone}
            title={format(new Date(lastDone), "PPP 'às' HH:mm", { locale: ptBR })}
          >
            {formatDistanceToNow(new Date(lastDone), {
              addSuffix: true,
              locale: ptBR,
            })}
          </time>
          {doneCount > 1 && ` · feito ${doneCount}×`}
        </p>
      )}
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  active: boolean;
  color: string;
  tint: string;
  border: string;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
}

function ToolbarButton({
  onClick,
  active,
  color,
  tint,
  border,
  disabled,
  icon,
  label,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-dm text-[12.5px] inline-flex items-center gap-1.5 px-3 py-2.5 md:py-1.5 rounded-full transition-all hover:translate-y-[-1px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      style={{
        color: active ? color : "rgba(253,251,247,0.65)",
        background: active ? tint : "rgba(255,255,255,0.025)",
        border: `1px solid ${active ? border : "rgba(255,255,255,0.08)"}`,
      }}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}
