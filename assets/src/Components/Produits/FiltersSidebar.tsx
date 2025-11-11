import React, { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300; // Délai pour consolider changements prix (ms)

export interface FiltersSidebarProps {
    search: string;
    setSearch: (v: string) => void;

    categories: { slug: string; name: string }[];
    selected: Set<string>;
    toggleCategory: (slug: string) => void;
    clearCategories: () => void;

    minPrice: number;
    maxPrice: number;
    priceRange: [number, number];
    setPriceRange: (r: [number, number]) => void;

    /** Couleur marque (ex: #e94e1b) */
    brandPrimary?: string;
    /** Hauteur du header fixe pour le sticky (px). Sinon on lit --header-h (fallback 76) */
    headerHeightPx?: number;
}

// Hook debounce pour setPriceRange (évite floods d'API sur sliders/inputs)
function useDebounceSetPrice(setPriceRange: (r: [number, number]) => void, delay: number = DEBOUNCE_MS) {
    const timeoutRef = useRef<NodeJS.Timeout>();
    return useCallback((newRange: [number, number]) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setPriceRange(newRange);
        }, delay);
    }, [setPriceRange, delay]);
}

export default function FiltersSidebar({
    search,
    setSearch,
    categories,
    selected,
    toggleCategory,
    clearCategories,
    minPrice,
    maxPrice,
    priceRange,
    setPriceRange,
    brandPrimary = "#e94e1b",
    headerHeightPx,
}: FiltersSidebarProps) {
    const [min, max] = priceRange;
    const styleVar = {
        ["--brand-primary" as any]: brandPrimary,
        ["--header-h" as any]: `${headerHeightPx ?? 76}px`,
    } as React.CSSProperties;

    const [openCats, setOpenCats] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const inputId = "filters-search-input";

    // Debounced setter pour prix
    const debouncedSetPrice = useDebounceSetPrice(setPriceRange);

    // Fermer le menu au clic extérieur / ESC
    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) setOpenCats(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpenCats(false);
        }
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    // helpers prix
    const clamp = (v: number, lo: number, hi: number) =>
        Math.min(Math.max(Number.isFinite(v) ? v : lo, lo), hi);

    // Handlers debounced pour inputs et sliders
    const onMinBox = (v: string) => {
        const n = clamp(Number(v || 0), minPrice, max);
        debouncedSetPrice([n, max]);
    };
    const onMaxBox = (v: string) => {
        const n = clamp(Number(v || 0), min, maxPrice);
        debouncedSetPrice([min, n]);
    };

    const onMinRange = (v: string) => {
        const n = clamp(Number(v), minPrice, max);
        debouncedSetPrice([n, max]);
    };
    const onMaxRange = (v: string) => {
        const n = clamp(Number(v), min, maxPrice);
        debouncedSetPrice([min, n]);
    };

    const selectedCount = selected.size;

    return (
        <aside
            className="sticky h-fit rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            style={{
                ...styleVar,
                top: `calc(var(--header-h, 76px) + 50px)`  // MODIF: Ajout de 20px d'espace en haut pour éviter chevauchement header
            }}
        >
            {/* Recherche + sélecteur Catégories */}
            <div className="mb-6" ref={wrapRef}>
                <label
                    htmlFor={inputId}
                    className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-500"
                >
                    Recherche / Catégories
                </label>

                <div className="relative">
                    <input
                        id={inputId}
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => setOpenCats(true)}
                        placeholder="Rechercher un produit…"
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 pr-24 text-sm outline-none"
                        autoComplete="off"
                        style={styleVar}
                    />
                    <button
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={openCats}
                        aria-controls="cats-popover"
                        onClick={() => setOpenCats((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-3 py-1.5 text-xs font-semibold text-[var(--brand-primary)] hover:bg-zinc-100"
                        style={styleVar}
                    >
                        Catégories
                    </button>

                    {openCats && (
                        <div
                            id="cats-popover"
                            ref={listboxRef}
                            className="absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg"
                            role="listbox"
                            aria-label="Sélectionner des catégories"
                        >
                            <div className="max-h-64 overflow-y-auto p-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                                        Sélectionner des catégories
                                    </span>
                                    <button
                                        onClick={() => {
                                            clearCategories();
                                            // ne ferme pas de force, laisse l’utilisateur continuer
                                        }}
                                        className="text-xs text-[var(--brand-primary)] hover:underline"
                                        style={styleVar}
                                    >
                                        Effacer
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                    {categories.map((c) => {
                                        const checked = selected.has(c.slug);
                                        const optionId = `cat-${c.slug}`;
                                        return (
                                            <label
                                                key={c.slug}
                                                htmlFor={optionId}
                                                className="flex cursor-pointer items-center gap-2 text-sm"
                                                role="option"
                                                aria-selected={checked}
                                            >
                                                <input
                                                    id={optionId}
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleCategory(c.slug)}
                                                    className="h-4 w-4 rounded border-zinc-300 text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                                                    style={styleVar}
                                                />
                                                <span className="select-none">{c.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 p-2">
                                <button
                                    type="button"
                                    onClick={() => setOpenCats(false)}
                                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {selectedCount > 0 && (
                    <p className="mt-1 truncate text-xs text-zinc-500">
                        {selectedCount} catégorie{selectedCount > 1 ? "s" : ""} sélectionnée
                        {selectedCount > 1 ? "s" : ""}
                    </p>
                )}
            </div>

            {/* Prix */}
            <div className="mb-6">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Prix
                </span>

                {/* Inputs numériques */}
                <div className="flex items-center gap-2 text-sm">
                    <input
                        type="number"
                        inputMode="numeric"
                        min={minPrice}
                        max={maxPrice}
                        value={Number.isFinite(min) ? min : minPrice}
                        onChange={(e) => onMinBox(e.target.value)}
                        className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
                    />
                    <span>—</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={minPrice}
                        max={maxPrice}
                        value={Number.isFinite(max) ? max : maxPrice}
                        onChange={(e) => onMaxBox(e.target.value)}
                        className="w-24 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
                    />
                </div>

                {/* Sliders superposés */}
                <div className="mt-3">
                    <input
                        type="range"
                        min={minPrice}
                        max={maxPrice}
                        value={Number.isFinite(min) ? min : minPrice}
                        onChange={(e) => onMinRange(e.target.value)}
                        className="w-full cursor-pointer"
                    />
                    <input
                        type="range"
                        min={minPrice}
                        max={maxPrice}
                        value={Number.isFinite(max) ? max : maxPrice}
                        onChange={(e) => onMaxRange(e.target.value)}
                        className="-mt-2 w-full cursor-pointer"
                    />

                    <div className="mt-1 text-xs text-zinc-600">
                        {new Intl.NumberFormat("fr-MG").format(min)} —{" "}
                        {new Intl.NumberFormat("fr-MG").format(max)} Ar
                    </div>
                </div>
            </div>
        </aside>
    );
}