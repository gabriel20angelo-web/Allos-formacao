"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useState } from "react";

interface CourseFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  priceFilter: "all" | "free" | "paid";
  onPriceFilterChange: (filter: "all" | "free" | "paid") => void;
  sortBy: "recent" | "rating" | "popular";
  onSortChange: (sort: "recent" | "rating" | "popular") => void;
}

export default function CourseFilters({
  search,
  onSearchChange,
  selectedCategories,
  onCategoriesChange,
  priceFilter,
  onPriceFilterChange,
  sortBy,
  onSortChange,
}: CourseFiltersProps) {
  const { categories: availableCategories } = useCategories();
  const [filtersOpen, setFiltersOpen] = useState(false);

  function toggleCategory(cat: string) {
    if (selectedCategories.includes(cat)) {
      onCategoriesChange(selectedCategories.filter((c) => c !== cat));
    } else {
      onCategoriesChange([...selectedCategories, cat]);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-cream/30" style={{ width: 18, height: 18 }} />
          <input
            type="text"
            placeholder="Buscar cursos..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-3 sm:py-3.5 dark-input rounded-[12px] text-sm sm:text-[15px]"
            aria-label="Buscar cursos"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-2 px-5 py-3.5 rounded-[12px] text-sm font-semibold transition-all duration-200"
          style={{
            background: filtersOpen
              ? "linear-gradient(135deg, #C84B31, #A33D27)"
              : "rgba(255,255,255,0.04)",
            border: filtersOpen
              ? "1.5px solid #C84B31"
              : "1.5px solid rgba(255,255,255,0.08)",
            color: filtersOpen ? "#fff" : "rgba(253,251,247,0.6)",
            boxShadow: filtersOpen ? "0 2px 12px rgba(200,75,49,0.3)" : "none",
          }}
          aria-expanded={filtersOpen}
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
        </button>
      </div>

      {/* Expanded filters */}
      {filtersOpen && (
        <div
          className="rounded-[16px] p-6 space-y-5 animate-fade-up"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(200,75,49,0.08)",
            backdropFilter: "blur(16px)",
          }}
        >
          {/* Categories */}
          <div>
            <h4 className="text-sm font-semibold text-cream/70 mb-3">
              Categoria
            </h4>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className="px-3 py-1.5 rounded-pill text-xs font-medium transition-all duration-200"
                  style={{
                    background: selectedCategories.includes(cat)
                      ? "linear-gradient(135deg, #C84B31, #A33D27)"
                      : "rgba(255,255,255,0.04)",
                    color: selectedCategories.includes(cat) ? "#fff" : "rgba(253,251,247,0.45)",
                    border: `1px solid ${selectedCategories.includes(cat) ? "#C84B31" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: selectedCategories.includes(cat) ? "0 2px 8px rgba(200,75,49,0.25)" : "none",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Price filter */}
          <div>
            <h4 className="text-sm font-semibold text-cream/70 mb-3">Tipo</h4>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "all", label: "Todos" },
                  { value: "free", label: "Gratuitos" },
                  { value: "paid", label: "Pagos" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onPriceFilterChange(opt.value)}
                  className="px-4 py-1.5 rounded-pill text-xs font-medium transition-all duration-200"
                  style={{
                    background: priceFilter === opt.value
                      ? "linear-gradient(135deg, #C84B31, #A33D27)"
                      : "rgba(255,255,255,0.04)",
                    color: priceFilter === opt.value ? "#fff" : "rgba(253,251,247,0.45)",
                    border: `1px solid ${priceFilter === opt.value ? "#C84B31" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: priceFilter === opt.value ? "0 2px 8px rgba(200,75,49,0.25)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <h4 className="text-sm font-semibold text-cream/70 mb-3">
              Ordenar por
            </h4>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "recent", label: "Mais recentes" },
                  { value: "rating", label: "Melhor avaliados" },
                  { value: "popular", label: "Mais alunos" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className="px-4 py-1.5 rounded-pill text-xs font-medium transition-all duration-200"
                  style={{
                    background: sortBy === opt.value
                      ? "linear-gradient(135deg, #C84B31, #A33D27)"
                      : "rgba(255,255,255,0.04)",
                    color: sortBy === opt.value ? "#fff" : "rgba(253,251,247,0.45)",
                    border: `1px solid ${sortBy === opt.value ? "#C84B31" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: sortBy === opt.value ? "0 2px 8px rgba(200,75,49,0.25)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {(selectedCategories.length > 0 ||
            priceFilter !== "all" ||
            sortBy !== "recent") && (
            <button
              onClick={() => {
                onCategoriesChange([]);
                onPriceFilterChange("all");
                onSortChange("recent");
              }}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent-light transition-colors duration-200"
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
