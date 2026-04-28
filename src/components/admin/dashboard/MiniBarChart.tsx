"use client";

export default function MiniBarChart({
  data,
  color,
  height = "h-28",
  labelInterval,
}: {
  data: { date: string; count: number }[];
  color: string;
  height?: string;
  labelInterval?: number;
}) {
  if (data.length === 0) return null;
  const maxCount = Math.max(...data.map((e) => e.count), 1);
  const interval = labelInterval || Math.max(1, Math.floor(data.length / 6));

  return (
    <div className={`flex items-end gap-1 ${height}`}>
      {data.map((item, idx) => {
        const h = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        const dateLabel = item.date.split("-").slice(1).join("/");
        return (
          <div
            key={item.date}
            className="flex-1 flex flex-col items-center justify-end group relative"
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div
                className="px-2 py-0.5 rounded text-[9px] font-dm font-medium text-cream whitespace-nowrap"
                style={{
                  background: "rgba(30,30,30,0.95)",
                  border: `1px solid ${color}33`,
                }}
              >
                {item.count} &middot; {dateLabel}
              </div>
            </div>
            <div
              className="w-full rounded-t-md min-h-[4px] transition-all duration-200"
              style={{
                height: `${Math.max(h, 8)}%`,
                background: `linear-gradient(180deg, ${color}cc 0%, ${color}66 100%)`,
                boxShadow: `0 0 6px ${color}22`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `linear-gradient(180deg, ${color} 0%, ${color}aa 100%)`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = `linear-gradient(180deg, ${color}cc 0%, ${color}66 100%)`)
              }
            />
            {idx % interval === 0 && (
              <span className="text-[8px] text-cream/20 mt-1 font-dm">
                {dateLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
