// assets/src/Components/Produits/ProductsClient.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import FiltersSidebar from "./FiltersSidebar";
import ProductsGrid from "./ProductsGrid";
import Pagination from "./Pagination";
import { fetchProducts, FetchProductsResp } from "../../lib/produits";

const PER_PAGE = 16;
const CACHE_TTL = 10000; // 10s TTL pour cache in-memory

/** Récupère le slug de catégorie depuis l’environnement (archive Woo) */
function getCategorySlugFromEnv(win: Window, doc: Document): string | null {
    try {
        // 1) Body classes WordPress: "tax-product_cat term-<slug> term-<id>"
        const classes = Array.from(doc.body?.classList ?? []);
        if (classes.includes("tax-product_cat")) {
            // on préfère une classe "term-<slug>" non numérique si présente
            const termClasses = classes.filter((c) => c.startsWith("term-")).map((c) => c.replace(/^term-/, ""));
            // slug plausible = contient des lettres
            const slugClass = termClasses.find((t) => /[a-z]/i.test(t));
            if (slugClass) return decodeURIComponent(slugClass.toLowerCase());
        }

        // 2) Querystring
        const u = new URL(win.location.href);
        const q =
            u.searchParams.get("product_cat") ||
            u.searchParams.get("category") ||
            u.searchParams.get("cat") ||
            u.searchParams.get("c");
        if (q) return decodeURIComponent(q.toLowerCase());

        // 3) Pathname: FR/EN + variantes
        const bases = [
            "product-category",
            "categorie-produit",
            "categorie",
            "category",
            "boutique",
            "shop",
            "produits",
        ];
        const parts = win.location.pathname.split("/").filter(Boolean);
        const baseIdx = parts.findIndex((p) => bases.includes(p.toLowerCase()));
        if (baseIdx >= 0) {
            const after = parts.slice(baseIdx + 1).filter(Boolean);
            if (after.length > 0) {
                const pagePos = after.findIndex((p) => p.toLowerCase() === "page");
                const cleaned = pagePos >= 0 ? after.slice(0, pagePos) : after;
                const last = cleaned[cleaned.length - 1];
                if (last) return decodeURIComponent(last.toLowerCase());
            }
        }
        return null;
    } catch {
        return null;
    }
}

/** petit clamp safe */
const clamp = (v: number, lo: number, hi: number) =>
    Math.min(Math.max(Number.isFinite(v) ? v : lo, lo), hi);

/** Cache in-memory simple (key: stringified params, value: {data, timestamp}) */
function createCache() {
    const cache = new Map<string, { data: FetchProductsResp; ts: number }>();
    return {
        get: (key: string) => {
            const entry = cache.get(key);
            if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
            cache.delete(key);
            return null;
        },
        set: (key: string, data: FetchProductsResp) => cache.set(key, { data, ts: Date.now() }),
        clear: () => cache.clear(),
    };
}

/** Dispatch event pour sync Header (utilisé dans handleReset) */
function dispatchSearchUpdate(term: string) {
    if (typeof window !== "undefined") {
        console.log('ProductsClient dispatching search-updated in reset:', term); // Debug
        document.dispatchEvent(new CustomEvent("search-updated", { detail: { term } }));
    }
}

export default function ProductsClient({
    brandPrimary = "#e94e1b",
    brandDark = "#29235c",
}: {
    brandPrimary?: string;
    brandDark?: string;
}) {
    const [loading, setLoading] = useState(true);
    const [resp, setResp] = useState<FetchProductsResp | null>(null);

    // ---- INIT selected et search depuis l’URL/DOM AVANT 1er render
    const [selected, setSelected] = useState<Set<string>>(() => {
        if (typeof window === "undefined") return new Set();
        const slug = getCategorySlugFromEnv(window, document);
        return slug ? new Set([slug]) : new Set();
    });

    // NOUVEAU : Init search depuis URL ?q= ou ?s=
    const [search, setSearch] = useState(() => {
        if (typeof window === "undefined") return "";
        const url = new URL(window.location.href);
        return url.searchParams.get("q") || url.searchParams.get("s") || "";
    });

    // Filtres
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
    const [dateRange, setDateRange] = useState<[string | null, string | null]>([null, null]);

    // pagination
    const [page, setPage] = useState(1);

    // Min/Max globaux pour UI (fetch sans filtres)
    const [globalMinMax, setGlobalMinMax] = useState<[number, number]>([0, 0]);
    const didInitGlobal = useRef(false);

    // Guards init
    const didInitFromURL = useRef(false);
    const didInitPrice = useRef(false);

    // NOUVEAU : Cache in-memory
    const apiCache = useRef(createCache());

    // (Ré)init depuis l’URL/DOM au montage + navigation retour/avant (selected seulement)
    useEffect(() => {
        if (typeof window === "undefined") return;

        const applyFromEnv = () => {
            const slug = getCategorySlugFromEnv(window, document);
            setSelected((prev) => {
                if (slug) {
                    if (!(prev.size === 1 && prev.has(slug))) return new Set([slug]);
                    return prev;
                }
                // pas de slug ⇒ pas de filtre
                if (!didInitFromURL.current && prev.size === 0) return prev;
                return new Set();
            });
            setPage(1);
            didInitFromURL.current = true;
        };

        if (!didInitFromURL.current) applyFromEnv();

        const onPop = () => applyFromEnv();
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    // Fix : Écoute événement search-updated du Header (sur document pour bubbling)
    useEffect(() => {
        const handleSearchUpdate = (e: CustomEvent<{ term: string }>) => {
            console.log('ProductsClient caught search-updated:', e.detail.term); // Debug
            const newSearch = e.detail.term;
            if (newSearch !== search) {
                setSearch(newSearch);
                setPage(1); // Reset pagination sur nouvelle recherche
                if (newSearch) {
                    // Si recherche, clear catégories pour focus
                    setSelected(new Set());
                }
            }
        };

        document.addEventListener("search-updated", handleSearchUpdate as EventListener);
        return () => document.removeEventListener("search-updated", handleSearchUpdate as EventListener);
    }, [search]);

    // Fix : Sync avec changements URL pour search (popstate étendu sur document)
    useEffect(() => {
        const handlePopState = () => {
            console.log('ProductsClient popstate:', window.location.search); // Debug
            const url = new URL(window.location.href);
            const urlSearch = url.searchParams.get("q") || url.searchParams.get("s") || "";
            if (urlSearch !== search) {
                setSearch(urlSearch);
                setPage(1);
                if (urlSearch) setSelected(new Set());
            }
        };

        document.addEventListener("popstate", handlePopState);
        return () => document.removeEventListener("popstate", handlePopState);
    }, [search]);

    // Fix : Init depuis template data-attr (si page-recherche.php)
    useEffect(() => {
        if (typeof window !== "undefined") {
            const appEl = document.getElementById('products-root') || document.getElementById('products-app');
            const initialSearch = appEl?.dataset.searchTerm || (typeof window.initialSearch !== 'undefined' ? window.initialSearch : '') || new URLSearchParams(window.location.search).get('s') || '';
            if (initialSearch && initialSearch !== search) {
                console.log('ProductsClient init search from data/URL:', initialSearch); // Debug
                setSearch(initialSearch);
                setPage(1);
                if (initialSearch) setSelected(new Set());
            }
        }
    }, []);

    // Fetch min/max globaux une seule fois (sans filtres)
    useEffect(() => {
        if (didInitGlobal.current || typeof window === "undefined") return;

        let alive = true;
        (async () => {
            try {
                const globalKey = "global_minmax"; // Key fixe pour global
                let globalData = apiCache.current.get(globalKey);
                if (!globalData) {
                    // Cache-bust seulement pour global (unique)
                    const cacheBust = Date.now();
                    globalData = await fetchProducts({
                        search: "",
                        categories: [],
                        min_price: undefined,
                        max_price: undefined,
                        date_from: undefined,
                        date_to: undefined,
                        page: 1,
                        per_page: 1, // Min pour meta seulement
                        orderby: "date",
                        order: "DESC",
                        _cache_bust: cacheBust, // Si supporté dans fetchProducts
                    });
                    apiCache.current.set(globalKey, globalData);
                }
                if (!alive) return;

                const min = Number(globalData.min_price || 0);
                const max = Number(globalData.max_price || 0);
                setGlobalMinMax([min, Math.max(min, max)]);
                setPriceRange([min, Math.max(min, max)]); // Init plage à global
                didInitGlobal.current = true;
                didInitPrice.current = true;
            } catch (e) {
                console.error("Erreur fetch global min/max:", e);
                // Fallback
                setGlobalMinMax([0, 100000]);
                setPriceRange([0, 100000]);
                didInitGlobal.current = true;
                didInitPrice.current = true;
            }
        })();
        return () => { alive = false; };
    }, []);

    // Fetch produits filtrés avec cache et bust conditionnel
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                console.log('ProductsClient fetching products with search:', search, 'page:', page); // Debug
                setLoading(true);
                // Key cache : stringify params (incl. page pour pagination)
                const paramsKey = JSON.stringify({
                    search,
                    categories: Array.from(selected),
                    min_price: priceRange[0] > 0 ? priceRange[0] : undefined,
                    max_price: priceRange[1] < globalMinMax[1] ? priceRange[1] : undefined,
                    date_from: dateRange[0],
                    date_to: dateRange[1],
                    page, // CORRECTION : Inclure page pour cache précis
                });
                let data = apiCache.current.get(paramsKey);

                if (!data) {
                    // Cache-bust seulement si changement majeur (non-prix pur)
                    const needsBust = selected.size > 0 || search || dateRange[0] || dateRange[1] || priceRange[0] > 0 || priceRange[1] < globalMinMax[1];
                    const cacheBust = needsBust ? Date.now() : undefined;

                    data = await fetchProducts({
                        search,
                        categories: Array.from(selected),
                        min_price: priceRange[0] > 0 ? priceRange[0] : undefined,
                        max_price: priceRange[1] < globalMinMax[1] ? priceRange[1] : undefined,
                        date_from: dateRange[0] || undefined,
                        date_to: dateRange[1] || undefined,
                        page,
                        per_page: PER_PAGE,
                        orderby: "date",
                        order: "DESC",
                        _cache_bust: cacheBust, // Optionnel : seulement si bust needed
                    });
                    // Cache seulement si pas bust (réutilisable)
                    if (!cacheBust) apiCache.current.set(paramsKey, data);
                }

                if (!alive) return;
                console.log('ProductsClient fetch response:', data); // Debug : Vérifiez items, total
                if (!data.items?.length) console.warn('No results: Check backend query or API'); // Debug
                setResp(data);

                // Pas de clamping dynamique
                if (priceRange[0] > globalMinMax[1] || priceRange[1] < globalMinMax[0]) {
                    setPriceRange(globalMinMax);
                }
            } catch (e) {
                console.error('ProductsClient fetch error:', e); // Debug
                if (alive)
                    setResp({
                        items: [],
                        total: 0,
                        total_pages: 1,
                        min_price: globalMinMax[0],
                        max_price: globalMinMax[1],
                        categories: [] as any,
                        currency: "MGA",
                    });
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [search, selected, page, dateRange, priceRange, globalMinMax]);

    // Catégories (facettes) — attendu: {slug,name}[]
    const facetCategories = useMemo<{ slug: string; name: string }[]>(() => {
        const raw = (resp?.categories ?? []) as any[];

        // Dédupe simple par slug
        const seen = new Set<string>();
        const out: { slug: string; name: string }[] = [];

        for (const c of raw) {
            if (c && typeof c === "object" && c.slug) {
                const slug = String(c.slug);
                if (!seen.has(slug)) {
                    out.push({ slug, name: c.name ?? slug.replace(/-/g, " ") });
                    seen.add(slug);
                }
            } else if (typeof c === "string") {
                const slug = c;
                if (!seen.has(slug)) {
                    out.push({ slug, name: slug.replace(/-/g, " ") });
                    seen.add(slug);
                }
            }
        }
        return out;
    }, [resp]);

    // Reset page à 1 quand filtres changent (hors page)
    useEffect(() => {
        setPage(1);
    }, [search, selected, dateRange, priceRange]);

    const toggleCategory = (slug: string) => {
        const next = new Set(selected);
        if (next.has(slug)) next.delete(slug);
        else next.add(slug);
        setSelected(next);
        setPage(1);
    };

    const clearCategories = () => {
        setSelected(new Set());
        setPage(1);
    };

    const total = resp?.total ?? 0;
    const totalPages = Math.max(1, resp?.total_pages ?? 1);

    const styleVar = {
        ["--brand-primary" as any]: brandPrimary,
        ["--brand-dark" as any]: brandDark,
    } as React.CSSProperties;

    const hasProducts = (resp?.items ?? []).length > 0;

    // NOUVEAU : Titre dynamique pour recherche
    const isSearchActive = search.trim().length > 0;
    const headerTitle = isSearchActive
        ? `Résultats de recherche pour "${search}"`
        : "Produits par catégorie";
    const headerSubtitle = isSearchActive
        ? `${total} résultat${total > 1 ? "s" : ""} trouvé${total > 1 ? "s" : ""}`
        : `${total} produit${total > 1 ? "s" : ""} — page ${Math.min(page, totalPages)}/${totalPages}`;

    // NOUVEAU : Handler reset avec URL et event
    const handleReset = () => {
        setSearch("");
        clearCategories();
        setPriceRange(globalMinMax);
        setDateRange([null, null]);
        setPage(1);
        apiCache.current.clear();
        // Clear URL search params
        const url = new URL(window.location.href);
        url.searchParams.delete("q");
        url.searchParams.delete("s");
        window.history.replaceState({}, "", url.toString());
        // Dispatch clear event pour sync header
        dispatchSearchUpdate(""); // Fix: Utilise fonction locale
    };

    return (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8" style={styleVar}>
            <header className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500">
                        {isSearchActive ? "Recherche" : "Catalogue"}
                    </p>
                    <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
                        {headerTitle}
                    </h1>
                    <p className="mt-1 text-xs text-zinc-500">
                        {loading ? "Chargement…" : headerSubtitle}
                    </p>
                </div>

                <button
                    onClick={handleReset}
                    className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                >
                    {isSearchActive ? "Effacer recherche" : "Réinitialiser filtres"}
                </button>
            </header>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,30%)_minmax(0,70%)]">
                {/* Sidebar : Masquée en mode recherche pure */}
                {!isSearchActive ? (
                    <FiltersSidebar
                        search={search}
                        setSearch={setSearch}
                        categories={facetCategories}
                        selected={selected}
                        toggleCategory={toggleCategory}
                        clearCategories={clearCategories}
                        minPrice={globalMinMax[0]}
                        maxPrice={globalMinMax[1]}
                        priceRange={priceRange}
                        setPriceRange={setPriceRange}
                        brandPrimary={brandPrimary}
                        headerHeightPx={76}
                    />
                ) : (
                    <div className="hidden lg:block" /> // Placeholder pour grille équilibrée
                )}

                <div className="space-y-4">
                    {loading ? (
                        // OPTIM : Plus de skeletons pour masquer latence
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-zinc-200 p-4">
                                    <div className="aspect-[4/5] w-full animate-pulse bg-zinc-100" />
                                    <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
                                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
                                </div>
                            ))}
                        </div>
                    ) : hasProducts ? (
                        <>
                            <ProductsGrid
                                products={(resp?.items ?? []).map((it) => ({
                                    id: it.id,
                                    title: it.title,
                                    img: it.image,
                                    category: it.category,
                                    ref: it.ref || "",
                                    price: it.price,
                                    currency: it.currency,
                                    permalink: it.permalink,
                                }))}
                            />

                            <Pagination
                                currentPage={Math.min(page, totalPages)}
                                perPage={PER_PAGE}
                                total={total}
                                onPageChange={(p) => setPage(clamp(p, 1, totalPages))}
                                brandPrimary={brandPrimary}
                            />
                        </>
                    ) : (
                        <div className="rounded-2xl border border-zinc-200 p-6 text-center">
                            <p className="text-sm text-zinc-700">
                                {isSearchActive
                                    ? `Aucun résultat pour "${search}". Essayez un autre terme.`
                                    : "Aucun produit ne correspond à ces filtres."
                                }
                            </p>
                            <button
                                onClick={handleReset}
                                className="mt-3 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                            >
                                {isSearchActive ? "Effacer la recherche" : "Effacer les filtres"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}