"use client";

import { Star } from "lucide-react";
import { useState } from "react";

interface ReviewStarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
}

const sizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export default function ReviewStars({
  value,
  onChange,
  size = "md",
  interactive = false,
}: ReviewStarsProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => interactive && setHovered(0)}
      role={interactive ? "radiogroup" : undefined}
      aria-label="Avaliação"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (interactive ? hovered || value : value);
        return (
          <button
            key={star}
            type="button"
            onMouseEnter={() => interactive && setHovered(star)}
            onClick={() => interactive && onChange?.(star)}
            disabled={!interactive}
            className={`
              ${interactive ? "cursor-pointer" : "cursor-default"}
              transition-colors duration-150
            `}
            aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
          >
            <Star
              className={`
                ${sizes[size]}
                ${
                  filled
                    ? "fill-amber-400 text-amber-400"
                    : "fill-transparent text-cream/15"
                }
              `}
            />
          </button>
        );
      })}
    </div>
  );
}
