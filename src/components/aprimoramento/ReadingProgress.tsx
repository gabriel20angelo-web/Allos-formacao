"use client";

import { useEffect, useState } from "react";

interface Props {
  /** Cor do progresso — geralmente a cor da categoria do exercício. */
  color: string;
}

/**
 * Barra fina no topo da viewport mostrando progresso de leitura por scroll.
 * Atualiza com requestAnimationFrame pra não saturar o main thread. Some no print.
 */
export default function ReadingProgress({ color }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      const total =
        document.documentElement.scrollHeight - window.innerHeight;
      const current = window.scrollY;
      setProgress(total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0);
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", compute);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2px] z-[100] pointer-events-none print-hide"
      style={{ background: "rgba(255,255,255,0.04)" }}
      aria-hidden="true"
    >
      <div
        className="h-full origin-left"
        style={{
          background: color,
          transform: `scaleX(${progress / 100})`,
          transition: "transform 100ms linear",
        }}
      />
    </div>
  );
}
