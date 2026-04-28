"use client";

import { useState } from "react";

export default function HintButton({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors"
        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(253,251,247,0.3)" }}
      >?</button>
      {show && (
        <div
          className="absolute z-50 bottom-6 left-1/2 -translate-x-1/2 w-52 px-3 py-2 rounded-lg text-[11px] font-dm leading-relaxed"
          style={{ background: "#222", border: "1px solid #444", color: "rgba(253,251,247,0.7)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
        >
          {text}
          <button onClick={() => setShow(false)} className="absolute top-1 right-1.5 text-cream/30 hover:text-cream text-[10px]">x</button>
        </div>
      )}
    </span>
  );
}
