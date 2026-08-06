interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
}

/**
 * O padding cede no celular.
 *
 * Fixo em `p-6`, o card gastava 48px dos 360px de um celular comum, treze por
 * cento da tela, só em espaço vazio dos dois lados. E como quase todo conteúdo
 * dele é lista ou série de números, esses 48px eram a diferença entre uma
 * linha caber e quebrar. Do tablet para cima o respiro volta ao que era, então
 * nenhuma tela de desktop muda de aparência.
 */
const paddingStyles = {
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-6",
  lg: "p-5 sm:p-8",
};

export default function Card({
  children,
  className = "",
  hover = false,
  padding = "md",
}: CardProps) {
  return (
    <div
      className={`
        rounded-[16px] backdrop-blur-md
        bg-surface-2 border border-border-soft
        ${paddingStyles[padding]}
        ${
          hover
            ? "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(200,75,49,0.12)] hover:border-accent/20"
            : ""
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
}
