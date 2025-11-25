import React, { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 300;

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
    brandPrimary?: string;
    headerHeightPx?: number;
}

function useDebounceSetPrice(setPriceRange: (r: [number, number]) => void, delay: number) {
    const timeoutRef = useRef<NodeJS.Timeout>();
    return useCallback(
        (r: [number, number]) => {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setPriceRange(r), delay);
        },
        [setPriceRange, delay]
    );
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
    headerHeightPx = 76
}: FiltersSidebarProps) {

    const [min, max] = priceRange;
    const [openCats, setOpenCats] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const selectedCount = selected.size;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const touchStartX = useRef(0);
    const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
    const onTouchMove = (e: React.TouchEvent) => {
        if (e.touches[0].clientX - touchStartX.current < -60) setIsMobileOpen(false);
    };

    useEffect(() => {
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpenCats(false);
                setIsMobileOpen(false);
            }
        };
        document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                wrapperRef.current &&
                !wrapperRef.current.contains(e.target as Node)
            ) {
                setOpenCats(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const clamp = (v: number, lo: number, hi: number) =>
        Math.min(Math.max(Number(v) || lo, lo), hi);

    const debouncedSetPrice = useDebounceSetPrice(setPriceRange, DEBOUNCE_MS);

    const onMinBox = (v: string) => debouncedSetPrice([clamp(v, minPrice, max), max]);
    const onMaxBox = (v: string) => debouncedSetPrice([min, clamp(v, min, maxPrice)]);
    const onMinRange = (v: string) => debouncedSetPrice([clamp(v, minPrice, max), max]);
    const onMaxRange = (v: string) => debouncedSetPrice([min, clamp(v, min, maxPrice)]);

    const filteredCats = categories;

    // Toggle catégories sur input clique
    const onInputClick = () => setOpenCats(o => !o);

    // Décalage vertical supplémentaire du sidebar et du bouton mobile
    const VERTICAL_OFFSET_MOBILE = 70; // Ajuste ici (ex: 70px)
    const mobileSidebarTop = `calc(${headerHeightPx}px + ${VERTICAL_OFFSET_MOBILE}px)`;

    return (
        <>
            {/* OVERLAY MOBILE */}
            <div
                className={`
         fixed inset-0 bg-black/40 transition-opacity duration-300 md:hidden
         ${isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
       `}
                style={{ zIndex: 30 }}
                onClick={() => setIsMobileOpen(false)}
            />

            {/* MOBILE TOGGLE BUTTON */}
            {!isMobileOpen && (
                <button
                    className="
           fixed md:hidden left-3 
           z-45
           h-12 w-12 flex items-center justify-center rounded-full
           text-white shadow-lg transition-all
         "
                    style={{
                        backgroundColor: brandPrimary,
                        top: `calc(50% + ${VERTICAL_OFFSET_MOBILE}px)`,
                    }}
                    onClick={() => setIsMobileOpen(true)}
                >
                    {/* Chevron bas : ouvrir */}
                    <svg viewBox="0 0 24 24" className="w-7 h-7" stroke="currentColor" fill="none" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* SIDEBAR */}
            <aside
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                className={`
          fixed inset-y-0 left-0 w-72 bg-white shadow-xl p-4 rounded-r-2xl
          z-40
          transition-transform duration-300
          md:static md:w-[260px] md:rounded-2xl md:shadow-md md:translate-x-0
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
                style={{
                    top: isMobileOpen ? mobileSidebarTop : `calc(${headerHeightPx}px + 10px)`,
                    height: "420px",
                    maxHeight: "420px",
                    overflowY: "auto"
                }}
            >

                {/* CLOSE MOBILE */}
                <button
                    onClick={() => setIsMobileOpen(false)}
                    className="md:hidden absolute right-3 top-3 text-zinc-600"
                >
                    ✕
                </button>

                {/* SEARCH + CATEGORIES */}
                <div className="mb-6" ref={wrapperRef}>
                    <label className="block mb-2 text-xs uppercase font-semibold tracking-widest text-zinc-500">
                        Recherche / Catégories
                    </label>

                    <div className="relative">
                        <input
                            value={search}
                            readOnly
                            onClick={onInputClick}
                            tabIndex={0}
                            placeholder="Rechercher…"
                            className="w-full rounded-xl border border-zinc-300 px-3 py-2 pr-20 text-sm bg-white cursor-pointer select-none"
                        />

                        <button
                            type="button"
                            onClick={() => setOpenCats((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-3 py-1.5 
                     bg-zinc-100 hover:bg-zinc-200 rounded-md text-[var(--brand-primary)]"
                        >
                            Catégories
                        </button>

                        {openCats && (
                            <div
                                ref={popoverRef}
                                className="absolute left-0 top-full mt-2 w-full bg-white rounded-2xl shadow-xl 
                     p-3 border border-zinc-200 max-h-52 overflow-y-auto z-45"
                            >
                                {filteredCats.length === 0 ? (
                                    <p className="text-xs text-zinc-500 text-center py-2">Aucune catégorie trouvée</p>
                                ) : (
                                    filteredCats.map((c) => (
                                        <label key={c.slug} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(c.slug)}
                                                onChange={() => toggleCategory(c.slug)}
                                                className="text-[var(--brand-primary)]"
                                            />
                                            {c.name}
                                        </label>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {selectedCount > 0 && (
                        <p className="text-xs mt-1 text-zinc-500 truncate">
                            {selectedCount} catégorie{selectedCount > 1 ? "s" : ""}
                        </p>
                    )}
                </div>

                {/* PRICE */}
                <div className="mb-6">
                    <span className="block text-xs uppercase tracking-widest font-semibold text-zinc-500 mb-2">
                        Prix
                    </span>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            className="w-24 px-2 py-1 border rounded"
                            value={min}
                            onChange={(e) => onMinBox(e.target.value)}
                        />
                        <span>—</span>
                        <input
                            type="number"
                            className="w-24 px-2 py-1 border rounded"
                            value={max}
                            onChange={(e) => onMaxBox(e.target.value)}
                        />
                    </div>
                    <div className="mt-3">
                        <input
                            type="range"
                            min={minPrice}
                            max={maxPrice}
                            value={min}
                            onChange={(e) => onMinRange(e.target.value)}
                            className="w-full"
                        />
                        <input
                            type="range"
                            min={minPrice}
                            max={maxPrice}
                            value={max}
                            onChange={(e) => onMaxRange(e.target.value)}
                            className="-mt-2 w-full"
                        />
                        <div className="text-xs mt-1 text-zinc-600">
                            {min.toLocaleString("fr-MG")} — {max.toLocaleString("fr-MG")} Ar
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}