"use client";

interface Props {
  enabled: boolean;
  hours: number | null;
  bodyText: string;
  /** Title atual do curso, usado no preview. */
  title: string;
  onEnabledChange: (v: boolean) => void;
  onHoursChange: (v: number | null) => void;
  onBodyTextChange: (v: string) => void;
}

export default function CertificateStep({
  enabled,
  hours,
  bodyText,
  title,
  onEnabledChange,
  onHoursChange,
  onBodyTextChange,
}: Props) {
  return (
    <div className="max-w-2xl space-y-6">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="w-5 h-5 accent-teal"
        />
        <span className="font-medium text-cream">
          Emitir certificado ao concluir o curso
        </span>
      </label>

      {enabled && (
        <div className="space-y-6">
          {/* Carga horária */}
          <div>
            <label className="text-sm font-medium text-cream/70 block mb-2">
              Carga horária do certificado (horas)
            </label>
            <p className="text-xs text-cream/35 mb-2">
              Se vazio, será calculado automaticamente a partir da duração total das aulas.
            </p>
            <input
              type="number"
              min="1"
              max="999"
              value={hours ?? ""}
              onChange={(e) => {
                const v = e.target.value ? parseInt(e.target.value) : null;
                onHoursChange(v);
              }}
              placeholder="Ex: 45"
              className="w-full max-w-[200px] px-4 py-2.5 rounded-[10px] text-sm text-cream-90 placeholder:text-cream/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-all bg-white/5 border-[1.5px] border-white/10"
            />
          </div>

          {/* Texto do certificado */}
          <div>
            <label className="text-sm font-medium text-cream/70 block mb-2">
              Texto do certificado
            </label>
            <p className="text-xs text-cream/35 mb-2">
              Texto principal do certificado. Use{" "}
              <code className="text-teal/70">{"{nome}"}</code> para o nome do aluno,{" "}
              <code className="text-teal/70">{"{curso}"}</code> para o título do curso,{" "}
              <code className="text-teal/70">{"{horas}"}</code> para a carga horária e{" "}
              <code className="text-teal/70">{"{data}"}</code> para a data de emissão.
              Se vazio, usa o texto padrão.
            </p>
            <textarea
              value={bodyText}
              onChange={(e) => onBodyTextChange(e.target.value)}
              placeholder={
                'Certificamos que {nome} concluiu com aproveitamento o curso "{curso}", promovido pela Associação Allos, com carga horária total de {horas} horas, em {data}.'
              }
              rows={4}
              className="w-full px-4 py-3 rounded-[10px] text-sm text-cream-90 placeholder:text-cream/25 resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-all bg-white/5 border-[1.5px] border-white/10"
            />
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs text-cream/30 uppercase tracking-wider font-semibold mb-3">
              Preview
            </p>
            <div
              className="rounded-card p-8 text-center"
              style={{
                background: "rgba(255,255,255,0.97)",
                border: "2px solid rgba(200,75,49,0.15)",
              }}
            >
              <p className="text-xs text-[#888] tracking-wider uppercase mb-4">
                ASSOCIAÇÃO ALLOS · CERTIFICADO
              </p>
              <p className="text-sm text-[#444] mb-1">Certificamos que</p>
              <p className="font-fraunces font-bold text-xl text-[#c0392b] italic mb-4">
                Nome do Aluno
              </p>
              <p className="text-sm text-[#444] mb-1 max-w-md mx-auto leading-relaxed">
                {bodyText
                  ? bodyText
                      .replace("{nome}", "Nome do Aluno")
                      .replace("{curso}", title || "Nome do Curso")
                      .replace("{horas}", String(hours || "XX"))
                      .replace("{data}", "20 de março de 2026")
                  : `concluiu com aproveitamento o curso "${title || "Nome do Curso"}", promovido pela Associação Allos, com carga horária total de ${hours || "XX"} horas.`}
              </p>
              <div className="mt-6 pt-4" style={{ borderTop: "1px solid #eee" }}>
                <p className="text-xs text-[#888] italic">Coordenação Allos</p>
              </div>
              <p className="text-[10px] text-[#bbb] mt-4">ALLOS-2026-XXXXXX</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
