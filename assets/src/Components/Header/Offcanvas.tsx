import React, { useState, useEffect, useMemo } from "react";

type OffcanvasProps = {
    open: boolean;
    onClose: () => void;
};

const BRAND_BLUE = "#29235c";

/* ============================
   Bases REST & URL helpers
============================ */
function restBaseSite(): string {
    const s = (window as any).__BALLOU__?.restBaseSite as string | undefined;
    return (s && typeof s === "string") ? (s.endsWith("/") ? s : s + "/") : "/wp-json/site-info/v1/";
}

function getHomeURL(): string {
    const injected = (window as any).__BALLOU__?.home as string | undefined;
    if (injected) return injected.endsWith("/") ? injected : injected + "/";
    const linkEl = document.querySelector('link[rel="home"]') as HTMLLinkElement | null;
    if (linkEl?.href) return linkEl.href.endsWith("/") ? linkEl.href : linkEl.href + "/";
    try {
        const { origin, pathname } = window.location;
        const base = origin + "/";
        return base.endsWith("/") ? base : base + "/";
    } catch {
        return "/";
    }
}

function absURLOrJoin(base: string, href?: string | null): string {
    if (!href) return base;
    try {
        const u = new URL(href);
        return u.toString();
    } catch {
        if (!base.endsWith("/")) base += "/";
        if (href.startsWith("/")) href = href.slice(1);
        return base + href;
    }
}

/* ============================
   Fetchers
============================ */
async function fetchJsonPublic(url: string) {
    const res = await fetch(url, { method: "GET", credentials: "omit" });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`${res.status} ${body}`);
    }
    return res.json();
}

async function getCategoriesForMenu(): Promise<any[]> {
    const base = restBaseSite();
    const url = `${base}product-categories`;
    return fetchJsonPublic(url);
}

/* ============================
   Affichage helpers
============================ */
const getLabel = (c: any) => c?.label ?? c?.name ?? c?.slug ?? "Catégorie";
const getKey = (c: any) => c?.slug ?? String(c?.term_id ?? Math.random());

const isUncategorized = (c: any) => {
    const slug = (c?.slug ?? "").toString().toLowerCase();
    const name = (c?.name ?? "").toString().toLowerCase();
    return slug === "uncategorized" || slug === "non-classe" || name.includes("non class");
};

const getEffectiveCount = (c: any): number => {
    if (typeof c?.count_sum === "number" && c.count_sum > 0) return c.count_sum;
    if (typeof c?.count === "number" && c.count > 0) return c.count;
    if (Array.isArray(c?.children) && c.children.length) {
        return c.children.reduce((acc: number, ch: any) => acc + (Number(ch?.count) || 0), 0);
    }
    return 0;
};

const collatorFR = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

function makeCatHrefFactory(homeURL: string) {
    return (c: any) => {
        const raw =
            c?.url ||
            c?.permalink ||
            (c?.slug ? `/product-category/${encodeURIComponent(String(c.slug))}/` : "/");
        return absURLOrJoin(homeURL, raw);
    };
}

/* ============================
   Component
============================ */
const Offcanvas: React.FC<OffcanvasProps> = ({ open, onClose }) => {
    const [rawCategories, setRawCategories] = useState<any[]>([]);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const homeURL = useMemo(() => (typeof window !== "undefined" ? getHomeURL() : "/"), []);
    const catHref = useMemo(() => makeCatHrefFactory(homeURL), [homeURL]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                const categoryData = await getCategoriesForMenu();
                if (alive) setRawCategories(Array.isArray(categoryData) ? categoryData : []);
            } catch (e) {
                console.error("Error fetching categories:", e);
                if (alive) setRawCategories([]);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const categories = useMemo(() => {
        const filtered = rawCategories.filter((c) => !isUncategorized(c));
        filtered.sort((a, b) => collatorFR.compare(getLabel(a), getLabel(b)));
        return filtered;
    }, [rawCategories]);

    const toggleCategory = (categoryId: string) => {
        setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
    };

    return (
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* 🟢 Offcanvas scrollable */}
            <aside
                className={`fixed left-0 top-0 z-[61] w-[340px] max-w-[86vw] text-white shadow-xl transition-transform ${open ? "translate-x-0" : "-translate-x-full"
                    }`}
                style={{ backgroundColor: BRAND_BLUE }}
                role="dialog"
                aria-modal="true"
                aria-label="Menu des catégories"
            >
                {/* Conteneur scrollable avec header fixe */}
                <div className="flex flex-col h-screen">
                    {/* Header fixe */}
                    <div className="px-4 py-3 border-b border-white/10 shrink-0">
                        <h3 className="text-xl font-semibold text-white">Catégories de produits</h3>
                    </div>

                    {/* Contenu scrollable */}
                    <div className="flex-1 overflow-y-auto px-4 py-2">
                        {loading ? (
                            <div className="text-white">Chargement des catégories...</div>
                        ) : categories.length === 0 ? (
                            <div className="text-white/80">Aucune catégorie disponible.</div>
                        ) : (
                            categories.map((category: any) => {
                                const slug = category?.slug ?? String(category?.term_id ?? "");
                                const count = getEffectiveCount(category);
                                const childrenSorted = Array.isArray(category?.children)
                                    ? [...category.children]
                                        .filter((ch) => !isUncategorized(ch))
                                        .sort((a, b) => collatorFR.compare(getLabel(a), getLabel(b)))
                                    : [];
                                const hasChildren = childrenSorted.length > 0;

                                return (
                                    <div key={getKey(category)}>
                                        {hasChildren ? (
                                            <button
                                                className="w-full text-left flex items-center gap-2 py-2 text-white hover:bg-white/10 rounded-md"
                                                onClick={() => slug && toggleCategory(slug)}
                                            >
                                                <span className="inline-flex min-w-8 justify-center rounded-full bg-white/10 px-2 py-0.5 text-xs">
                                                    {count}
                                                </span>
                                                <span className="font-semibold">{getLabel(category)}</span>
                                            </button>
                                        ) : (
                                            <a
                                                href={catHref(category)}
                                                className="w-full text-left flex items-center gap-2 py-2 text-white hover:bg-white/10 rounded-md"
                                                title={getLabel(category)}
                                                onClick={onClose}
                                            >
                                                <span className="inline-flex min-w-8 justify-center rounded-full bg-white/10 px-2 py-0.5 text-xs">
                                                    {count}
                                                </span>
                                                <span className="font-semibold">{getLabel(category)}</span>
                                            </a>
                                        )}

                                        {hasChildren && expandedCategory === slug && (
                                            <div className="ml-4 mt-2 flex flex-wrap gap-2">
                                                {childrenSorted.map((child: any) => (
                                                    <a
                                                        key={getKey(child)}
                                                        href={catHref(child)}
                                                        className="inline-flex items-center gap-2 bg-white/10 text-white py-1 px-3 rounded-full text-sm hover:bg-white/15"
                                                        title={getLabel(child)}
                                                        onClick={onClose}
                                                    >
                                                        <span className="inline-flex min-w-6 justify-center rounded bg-white/10 px-1.5 py-[1px] text-[11px]">
                                                            {getEffectiveCount(child)}
                                                        </span>
                                                        {getLabel(child)}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Offcanvas;