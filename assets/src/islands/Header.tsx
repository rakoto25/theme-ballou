import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import CartBadge from "../Components/CartBadge";
import Offcanvas from "../Components/Header/Offcanvas";
import logoDefault from "../images/logo-ballou.png";

const BRAND = {
    blue: "#29235c",
    orange: "#e94e1b",
    dark: "#1b1919",
};

function restBaseSite(): string {
    const s = (window as any).__BALLOU__?.restBaseSite;
    return s ? (s.endsWith("/") ? s : s + "/") : "/wp-json/wc/v3/";
}

function getHomeURL(): string {
    const injected = (window as any).__BALLOU__?.home;
    if (injected) return injected.endsWith("/") ? injected : injected + "/";
    const linkEl = document.querySelector('link[rel="home"]') as HTMLLinkElement | null;
    if (linkEl?.href) return linkEl.href.endsWith("/") ? linkEl.href : linkEl.href + "/";
    try {
        const { origin } = window.location;
        return origin + "/";
    } catch {
        return "/";
    }
}

function joinURL(base: string, path: string) {
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const p = path.startsWith("/") ? path : "/" + path;
    return b + p;
}

function absURLOrJoin(base: string, href?: string | null): string {
    if (!href) return base;
    try {
        return new URL(href).toString();
    } catch {
        return joinURL(base, href);
    }
}

function isUserLoggedIn(): boolean {
    return Boolean(
        (window as any).__BALLOU__?.isLoggedIn ??
        (window as any).wpApiSettings?.isLoggedIn ??
        false
    );
}

async function fetchJsonPublic(url: string) {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function getCategoriesForMenu() {
    const base = restBaseSite().replace("/wc/v3/", "/site-info/v1/");
    return fetchJsonPublic(`${base}product-categories?per_page=100`);
}

async function getSiteLogoFromApi() {
    const base = restBaseSite().replace("/wc/v3/", "/site-info/v1/");
    try {
        const d = await fetchJsonPublic(`${base}site-logo`);
        return d?.url || d?.logo || null;
    } catch {
        return null;
    }
}

async function searchProducts(term: string) {
    if (!term.trim()) return [];
    const base = restBaseSite();
    const res = await fetch(`${base}products?search=${encodeURIComponent(term)}&per_page=5`);
    return res.ok ? res.json() : [];
}

const getCatLabel = (c: any) => c?.label ?? c?.name ?? c?.slug ?? "Catégorie";
const isUncategorized = (c: any) => (c?.slug ?? "").toLowerCase().includes("non-cl");
const collatorFR = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
    let timeout: any;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}

export default function Header() {
    const [rayonsOpen, setRayonsOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [loadingCategories, setLoading] = useState(true);
    const [logo, setLogo] = useState<string | null>(null);
    const [searchValue, setSearchValue] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const lastClickYRef = useRef(0);
    const lastScrollTimeRef = useRef(0);

    useEffect(() => {
        const trackClickY = (e: MouseEvent) => {
            lastClickYRef.current = e.clientY;
        };
        window.addEventListener("mousedown", trackClickY);
        return () => window.removeEventListener("mousedown", trackClickY);
    }, []);

    useEffect(() => {
        const el = document.querySelector(".header-categories-scroll");
        if (!el) return;
        const trackScroll = () => (lastScrollTimeRef.current = Date.now());
        el.addEventListener("scroll", trackScroll, { passive: true });
        return () => el.removeEventListener("scroll", trackScroll);
    }, []);

    const homeURL = getHomeURL();
    const hrefHome = homeURL;
    const hrefCart = joinURL(homeURL, "panier");
    const hrefAccount = joinURL(homeURL, "mon-compte");
    const hrefLogin = joinURL(homeURL, "connexion");
    const actionSearch = joinURL(homeURL, "recherche");

    const handleAccountClick = () => {
        window.location.href = isUserLoggedIn() ? hrefAccount : hrefLogin;
    };

    useEffect(() => {
        (async () => {
            try {
                const cats = await getCategoriesForMenu();
                setCategories(Array.isArray(cats) ? cats : []);
            } catch {
                setCategories([]);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            const url = await getSiteLogoFromApi();
            setLogo(url || logoDefault);
        })();
    }, []);

    const debouncedSearch = useCallback(
        debounce(async (value: string) => {
            if (value.trim().length < 3) {
                setResults([]);
                return;
            }
            setIsSearching(true);
            const r = await searchProducts(value);
            setResults(Array.isArray(r) ? r : []);
            setIsSearching(false);
        }, 300),
        []
    );

    const onSearchChange = useCallback((e: any) => {
        const value = e.target.value;
        setSearchValue(value);
        debouncedSearch(value);
    }, []);

    const onSearchSubmit = useCallback(
        (e: any) => {
            e.preventDefault();
            if (searchValue.trim().length < 3) return;
            e.currentTarget.submit();
        },
        [searchValue]
    );

    const sortedParents = useMemo(() => {
        const arr = categories.filter(c => !isUncategorized(c));
        return arr.sort((a, b) => collatorFR.compare(getCatLabel(a), getCatLabel(b)));
    }, [categories]);

    const top7 = sortedParents.slice(0, 7);
    const catHref = (c: any) => absURLOrJoin(homeURL, c?.url || `/product-category/${c?.slug}/`);
    const productHref = (p: any) => joinURL(homeURL, `produit/${p.slug}`);

    const HEADER_H = 76;

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-50">
                {/* BARRE HAUTE */}
                <div
                    className="text-white/60 shadow-[inset_0_-1px_0_rgba(255,255,255,.08)]"
                    style={{ backgroundColor: BRAND.blue }}
                >
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="flex h-18 items-center gap-4 py-2 md:h-20">
                            {/* LOGO */}
                            <a href={hrefHome} className="shrink-0 inline-flex items-center">
                                <img
                                    src={logo || logoDefault}
                                    alt="ballou — Spécialiste d’intérieur"
                                    className="site-logo block"
                                    style={{
                                        height: "40px",
                                        width: "auto",
                                        maxHeight: "40px",
                                        objectFit: "contain",
                                        transition: "none",
                                    }}
                                    loading="eager"
                                />
                            </a>
                            {/* SEARCH MOBILE */}
                            <form
                                action={actionSearch}
                                method="GET"
                                className={`md:hidden ${searchOpen ? "flex flex-1 relative" : "hidden"}`}
                                onSubmit={onSearchSubmit}
                            >
                                <div className="flex w-full items-center rounded-full bg-white/10 ring-1 ring-white/15">
                                    <input
                                        name="s"
                                        value={searchValue}
                                        onChange={onSearchChange}
                                        placeholder="Rechercher un produit…"
                                        className="w-full bg-transparent px-5 py-2.5 text-white outline-none"
                                        ref={searchInputRef}
                                    />
                                    <button className="p-2.5">
                                        <SearchIcon className="h-5 w-5 text-white/80" />
                                    </button>
                                </div>
                                {isSearching && (
                                    <div className="absolute top-full w-full bg-white p-2">
                                        Recherche…
                                    </div>
                                )}
                                {results.length > 0 && (
                                    <div className="absolute top-full w-full bg-white rounded-b-xl shadow">
                                        {results.map((p) => (
                                            <a key={p.id} href={productHref(p)} className="flex p-3">
                                                <img
                                                    className="w-12 h-12 rounded object-cover"
                                                    src={p.images?.[0]?.src}
                                                    alt={p.name}
                                                />
                                                <div className="ml-3">
                                                    <div className="font-medium">{p.name}</div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </form>
                            {/* SEARCH DESKTOP */}
                            <form
                                action={actionSearch}
                                method="GET"
                                className="hidden md:flex flex-1 relative"
                                onSubmit={onSearchSubmit}
                            >
                                <div className="flex w-full items-center rounded-full bg-white/10 ring-1 ring-white/15">
                                    <input
                                        name="s"
                                        value={searchValue}
                                        onChange={onSearchChange}
                                        placeholder="Rechercher un produit…"
                                        className="w-full bg-transparent px-5 py-2.5 text-white outline-none"
                                        ref={searchInputRef}
                                    />
                                    <button className="p-2.5">
                                        <SearchIcon className="h-5 w-5 text-white/80" />
                                    </button>
                                </div>
                                {results.length > 0 && (
                                    <div className="absolute top-full w-full bg-white shadow rounded-b-xl max-h-80 overflow-auto z-40">
                                        {results.map((p) => (
                                            <a key={p.id} href={productHref(p)} className="flex p-3">
                                                <img
                                                    className="w-12 h-12 rounded object-cover"
                                                    src={p.images?.[0]?.src}
                                                    alt={p.name}
                                                />
                                                <div className="ml-3">
                                                    <div className="font-medium">{p.name}</div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </form>

                            {/* ACTIONS */}
                            <div className="ml-auto flex items-center gap-1">
                                {!searchOpen && (
                                    <button
                                        className="md:hidden p-2"
                                        onClick={() => setSearchOpen(true)}
                                    >
                                        <SearchIcon className="h-6 w-6 text-white/80" />
                                    </button>
                                )}

                                {/* Mon compte: TOUJOURS visible, icône seule sur mobile */}
                                <button
                                    onClick={handleAccountClick}
                                    className="flex items-center gap-2 p-2"
                                >
                                    <UserIcon className="h-5 w-5 text-white/80" />
                                    <span className="hidden sm:inline">Mon compte</span>
                                </button>

                                <a href={hrefCart} className="relative flex items-center gap-2 p-2">
                                    <CartIcon className="h-5 w-5 text-white/80" />
                                    <span className="hidden sm:inline">Panier</span>
                                    <CartBadge />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                {/* BARRE DES CATEGORIES */}
                <div className="text-white/80" style={{ backgroundColor: BRAND.blue }}>
                    <div className="max-w-7xl mx-auto px-4">
                        <nav className="header-categories-scroll flex gap-2 overflow-x-auto py-2 no-scrollbar">
                            {loadingCategories ? (
                                <SkeletonChips />
                            ) : (
                                top7.map((c) => (
                                    <a
                                        key={c.slug}
                                        href={catHref(c)}
                                        className="px-3 py-1.5 rounded-full whitespace-nowrap"
                                    >
                                        {getCatLabel(c)}
                                    </a>
                                ))
                            )}
                            {sortedParents.length > 7 && (
                                <button
                                    onClick={(e) => {
                                        const now = Date.now();
                                        // Anti-scroll-trigger Safari
                                        if (now - lastScrollTimeRef.current < 150) return;
                                        // Anti click fantôme
                                        if (Math.abs(e.clientY - lastClickYRef.current) > 3) return;
                                        setRayonsOpen(true);
                                    }}
                                    className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10"
                                >
                                    <MenuIcon className="h-4 w-4" />
                                    <span className="hidden md:inline">Tous les rayons</span>
                                    <span className="md:hidden">Tous</span>
                                </button>
                            )}
                        </nav>
                    </div>
                    <div className="h-1 w-full" style={{ backgroundColor: BRAND.orange }} />
                </div>
                <Offcanvas
                    open={rayonsOpen}
                    onClose={() => setRayonsOpen(false)}
                />
            </header>
            <div style={{ height: HEADER_H }} />
        </>
    );
}

/* ============================
   Icons
============================ */
function SearchIcon(props: any) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-4.8-4.8m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z"
            />
        </svg>
    );
}
function MenuIcon(props: any) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.8" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    );
}
function CartIcon(props: any) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4h2l2 12h10l2-8H7M9 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
            />
        </svg>
    );
}
function UserIcon(props: any) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path
                strokeWidth="1.8"
                strokeLinecap="round"
                d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm7 8a7 7 0 0 0-14 0"
            />
        </svg>
    );
}
function SkeletonChips() {
    return (
        <>
            {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="h-7 w-24 animate-pulse rounded-full bg-white/10" />
            ))}
        </>
    );
}