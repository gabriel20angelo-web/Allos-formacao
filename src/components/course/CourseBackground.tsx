"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  flickerSpeed: number;
  flickerPhase: number;
}

interface Orb {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
  color: string;
}

export default function CourseBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Generate stars
    const stars: Star[] = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      speed: Math.random() * 0.00005 + 0.00002,
      flickerSpeed: Math.random() * 0.02 + 0.008,
      flickerPhase: Math.random() * Math.PI * 2,
    }));

    // Ambient orbs
    const orbs: Orb[] = [
      { x: 0.2, y: 0.3, r: 0.4, speed: 0.0002, phase: 0, color: "rgba(200,75,49," },
      { x: 0.8, y: 0.7, r: 0.35, speed: 0.00015, phase: 2, color: "rgba(46,158,143," },
      { x: 0.5, y: 0.1, r: 0.3, speed: 0.00025, phase: 4, color: "rgba(163,61,39," },
    ];

    const draw = () => {
      t += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw orbs
      orbs.forEach((orb) => {
        const px = (orb.x + Math.sin(t * orb.speed + orb.phase) * 0.12) * canvas.width;
        const py = (orb.y + Math.cos(t * orb.speed * 1.2 + orb.phase) * 0.1) * canvas.height;
        const rad = orb.r * Math.min(canvas.width, canvas.height);

        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, orb.color + "0.07)");
        g.addColorStop(0.5, orb.color + "0.03)");
        g.addColorStop(1, orb.color + "0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw stars
      stars.forEach((star) => {
        const flicker = Math.sin(t * star.flickerSpeed + star.flickerPhase) * 0.5 + 0.5;
        const alpha = star.opacity * flicker;

        const sx = star.x * canvas.width;
        const sy = ((star.y + t * star.speed) % 1.05) * canvas.height;

        // Star glow
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, star.size * 3);
        glow.addColorStop(0, `rgba(253,251,247,${alpha * 0.6})`);
        glow.addColorStop(0.5, `rgba(253,251,247,${alpha * 0.15})`);
        glow.addColorStop(1, "rgba(253,251,247,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Star core
        ctx.fillStyle = `rgba(253,251,247,${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      {/* Starfield + orbs canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
        style={{ opacity: 0.8 }}
      />
      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
    </>
  );
}
