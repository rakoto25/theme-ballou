// assets/src/islands/Header.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import CartBadge from "../Components/CartBadge";
import Offcanvas from "../Components/Header/Offcanvas"; // Adapté pour les props

// ✅ logo par défaut
import logoDefault from "../images/logo-ballou.png";

const BRAND = {
    blue: "#29235c",
    orange: "#e94e1b",
    dark: "#1b1919",
};

/* ============================
   Helpers REST & URL
============================ */
function restBaseSite(): string {
    const s = (window as any).__BALLOU__?.restBaseSite as string | undefined;
    return (s && typeof s === "string") ? (s.endsWith("/") ? s : s + "/") : "/wp-json/wc/v3/"; // Fix: WC REST pour products
}

function getHomeURL(): string {
    const injected = (window as any).__BALLOU__?.home as string | undefined;
    if (injected) return injected.endsWith("/") ? injected : injected + "/";
    const linkEl = document.querySelector('link[rel="home"]') as HTMLLinkElement | null;
    if (linkEl?.href) return linkEl.href.endsWith("/") ? linkEl.href : linkEl.href + "/";
    try {
        const { origin, pathname } = window.location;
        const parts = pathname.split("/").filter(Boolean);
        const first = parts[0];
        const looksLikeSubdir = !!first && (
            parts.includes("produit") ||
            parts.includes("product-category") ||
            parts.includes("categorie-produit") ||
            parts.includes("panier") ||
            parts.includes("mon-compte") ||
            parts.includes("recherche")
        );
        const base = looksLikeSubdir ? `${origin}/${first}/` : origin + "/";
        return base.endsWith("/") ? base : base + "/";
    } catch {
        return "/";
    }
}

function joinURL(base: string, path: string): string {
    if (!base) base = "/";
    if (!path) return base;
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const p = path.startsWith("/") ? path : `/${path}`;
    return b + p;
}

function absURLOrJoin(base: string, href?: string | null): string {
    if (!href) return base;
    try {
        const u = new URL(href);
        return u.toString();
    } catch {
        return joinURL(base, href);
    }
}

/* ============================
   Vérification User & Fetchers
============================ */
function isUserLoggedIn(): boolean {
    try {
        const g =
            (window as any).__BALLOU__?.isLoggedIn ??
            (window as any).wpApiSettings?.isLoggedIn ??
            false;
        return Boolean(g);
    } catch {
        return false;
    }
}

type WPAny = any;

async function fetchJsonPublic(url: string) {
    const res = await fetch(url, { method: "GET", credentials: "omit" });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
}

async function getCategoriesForMenu(): Promise<WPAny[]> {
    const base = restBaseSite().replace('/wc/v3/', '/site-info/v1/'); // Mix pour categories, ajustez si besoin
    try {
        return await fetchJsonPublic(`${base}product-categories?per_page=100`);
    } catch {
        return [];
    }
}

async function getSiteLogoFromApi(): Promise<string | null> {
    const base = restBaseSite().replace('/wc/v3/', '/site-info/v1/');
    try {
        const data = await fetchJsonPublic(`${base}site-logo`);
        return (data?.url || data?.logo || null) as string | null;
    } catch {
        return null;
    }
}

async function searchProducts(term: string): Promise<WPAny[]> {
    if (!term.trim()) return [];
    const wcBase = restBaseSite(); // /wp-json/wc/v3/
    const res = await fetch(`${wcBase}products?search=${encodeURIComponent(term)}&per_page=5&status=publish`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

/* ============================
   Helpers Affichage & Utils
============================ */
const getCatLabel = (c: any) => c?.label ?? c?.name ?? c?.slug ?? "Catégorie";
const isUncategorized = (c: any) => (c?.slug ?? "").toLowerCase().includes("non");
const collatorFR = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/** Détecte si sur page produits/recherche pour sync React sans reload */
function isOnProductsPage(): boolean {
    if (typeof window === "undefined") return false;
    const pathname = window.location.pathname.toLowerCase();
    return pathname.includes('recherche') || pathname.includes('boutique') || pathname.includes('shop') || pathname.includes('product-category') || pathname.includes('categorie-produit') || pathname.includes('produits');
}

/** Dispatch event pour ProductsClient (seulement sur submit, pas onChange) */
function dispatchSearchUpdate(term: string) {
    if (typeof window !== "undefined") {
        console.log('Header dispatching search-updated on submit:', term); // Debug
        document.dispatchEvent(new CustomEvent("search-updated", { detail: { term } }));
    }
}

/* ============================
   Composant Principal
============================ */
export default function Header() {
    const [rayonsOpen, setRayonsOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [logo, setLogo] = useState<string | null>(null);
    const [headerSearchValue, setHeaderSearchValue] = useState("");
    const [searchResults, setSearchResults] = useState<WPAny[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const lastKeystrokeTime = useRef(0); // Pour détecter frappe continue et clear dropdown

    const homeURL = useMemo(() => (typeof window !== "undefined" ? getHomeURL() : "/"), []);
    const hrefHome = homeURL;
    const hrefAccount = useMemo(() => joinURL(homeURL, "mon-compte"), [homeURL]);
    const hrefLogin = useMemo(() => joinURL(homeURL, "connexion"), [homeURL]);
    const hrefCart = useMemo(() => joinURL(homeURL, "panier"), [homeURL]);
    const actionSearch = useMemo(() => joinURL(homeURL, "recherche"), [homeURL]);

    const handleAccountClick = () => {
        const target = isUserLoggedIn() ? hrefAccount : hrefLogin;
        window.location.href = target;
    };

    /* Catégories */
    useEffect(() => {
        (async () => {
            try {
                setLoadingCategories(true);
                const data = await getCategoriesForMenu();
                setCategories(Array.isArray(data) ? data : []);
            } catch {
                setCategories([]);
            } finally {
                setLoadingCategories(false);
            }
        })();
    }, []);

    /* Logo */
    useEffect(() => {
        (async () => {
            const logoUrl = await getSiteLogoFromApi();
            setLogo((prev) => prev || logoUrl || logoDefault);
        })();
    }, []);

    /* Focus auto */
    useEffect(() => {
        if ((searchOpen || rayonsOpen) && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [searchOpen, rayonsOpen]);

    /* Debounced API pour dropdown seulement (min 3 chars, frappe continue clear) */
    const debouncedSearchDropdown = useCallback(
        debounce(async (value: string) => {
            const now = Date.now();
            if (now - lastKeystrokeTime.current < 300) { // Frappe continue : clear et skip
                setSearchResults([]);
                return;
            }
            if (value.trim().length < 3) { // Augmenté à 3 pour éviter single word trop tôt
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const results = await searchProducts(value);
                setSearchResults(results);
            } catch {
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300),
        []
    );

    const onSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setHeaderSearchValue(value); // Immédiat : saisie fluide, pas de lag
        lastKeystrokeTime.current = Date.now(); // Track pour frappe continue
        debouncedSearchDropdown(value); // Debounce seulement API dropdown
    }, [debouncedSearchDropdown]);

    /* Submit handler : Dispatch + URL seulement sur Entrée/clic (pour grille) */
    const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const term = headerSearchValue.trim();
        if (!term || term.length < 3) return; // Min 3 chars pour submit
        if (isOnProductsPage()) {
            // SPA-like : update URL sans reload + dispatch pour grille
            const url = new URL(window.location.href);
            url.searchParams.set('s', term);
            window.history.pushState({}, '', url.toString());
            dispatchSearchUpdate(term); // Trigger ProductsClient fetch/page 1
            setSearchResults([]); // Clear dropdown après submit
            if (searchOpen) setSearchOpen(false); // Close mobile
        } else {
            // Fallback : submit form vers /recherche?s=term
            e.currentTarget.submit();
        }
    }, [headerSearchValue]);

    const sortedParents = useMemo(() => {
        const arr = categories.filter((c) => !isUncategorized(c));
        arr.sort((a, b) => collatorFR.compare(getCatLabel(a), getCatLabel(b)));
        return arr;
    }, [categories]);

    const top7 = sortedParents.slice(0, 7);
    const catHref = (c: any) => absURLOrJoin(homeURL, c?.url || `/product-category/${c?.slug}/`);
    const productHref = (product: WPAny) => joinURL(homeURL, `produit/${product.slug}/`);
    const HEADER_H = 76;

    return (
        <>
            <header className="fixed inset-x-0 top-0 z-50">
                <div
                    className="text-white/60 shadow-[inset_0_-1px_0_rgba(255,255,255,.08)]"
                    style={{ backgroundColor: BRAND.blue }}
                >
                    <div className="mx-auto max-w-7xl px-4">
                        <div className="flex h-18 items-center gap-4 py-2 md:h-20">
                            <a href={hrefHome} className="shrink-0 inline-flex items-center" aria-label="Accueil">
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

                            {/* Recherche Mobile : Inline entre logo et actions quand ouvert */}
                            <form
                                action={actionSearch}
                                method="GET"
                                className={`md:hidden ${searchOpen ? 'flex flex-1 relative transition-all duration-300 opacity-100' : 'hidden opacity-0'}`}
                                onSubmit={handleSearchSubmit}
                            >
                                <div className="flex w-full items-center rounded-full bg-white/10 ring-1 ring-white/15 focus-within:bg-white/15 focus-within:ring-2">
                                    <input
                                        id="search-mobile"
                                        name="s"
                                        type="search"
                                        placeholder="Rechercher un produit"
                                        className="w-full bg-transparent px-5 py-2.5 text-white placeholder-white/60 outline-none"
                                        value={headerSearchValue}
                                        onChange={onSearchInputChange}
                                        ref={searchInputRef}
                                    />
                                    <button
                                        type="submit"
                                        className="m-1 inline-flex items-center rounded-full p-2.5 hover:bg-white/10 focus:outline-none"
                                    >
                                        <SearchIcon className="h-5 w-5 text-white/80" />
                                    </button>
                                </div>
                                {/* Live Dropdown Mobile : Sous le form */}
                                {isSearching && <div className="absolute inset-x-0 top-full bg-white/90 backdrop-blur-sm rounded-b-xl p-2 text-black z-10">Recherche en cours...</div>}
                                {searchResults.length > 0 && (
                                    <div className="absolute inset-x-0 top-full bg-white shadow-lg rounded-b-xl max-h-80 overflow-y-auto z-10 pointer-events-none" tabIndex={-1}>
                                        {searchResults.map((product) => (
                                            <a
                                                key={product.id}
                                                href={productHref(product)}
                                                className="flex gap-3 p-3 hover:bg-gray-100 border-b last:border-b-0 block"
                                                onClick={() => dispatchSearchUpdate("")}
                                            >
                                                <img
                                                    src={product.images?.[0]?.src || '/placeholder.jpg'}
                                                    alt={product.name}
                                                    className="w-12 h-12 object-cover rounded"
                                                    loading="lazy"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium truncate">{product.name}</h4>
                                                    {product.sku && <p className="text-sm text-gray-600">SKU: {product.sku}</p>}
                                                    <p className="text-sm text-gray-500 line-clamp-2">{product.description?.substring(0, 100)}...</p>
                                                </div>
                                            </a>
                                        ))}
                                        <a href={`${actionSearch}?s=${encodeURIComponent(headerSearchValue)}`} className="block p-3 text-center text-sm text-blue-600 hover:underline">Voir tous les résultats</a>
                                    </div>
                                )}
                            </form>

                            {/* Recherche Desktop */}
                            <form
                                action={actionSearch}
                                method="GET"
                                className="hidden md:flex flex-1 relative"
                                onSubmit={handleSearchSubmit}
                            >
                                <div className="flex w-full items-center rounded-full bg-white/10 ring-1 ring-white/15 focus-within:bg-white/15 focus-within:ring-2">
                                    <input
                                        id="search-desktop"
                                        name="s" // Fix: Woo standard "s"
                                        type="search"
                                        placeholder="Rechercher un produit"
                                        className="w-full bg-transparent px-5 py-2.5 text-white placeholder-white/60 outline-none"
                                        value={headerSearchValue}
                                        onChange={onSearchInputChange}
                                        ref={searchInputRef}
                                    />
                                    <button
                                        type="submit"
                                        className="m-1 inline-flex items-center rounded-full p-2.5 hover:bg-white/10 focus:outline-none"
                                    >
                                        <SearchIcon className="h-5 w-5 text-white/80" />
                                    </button>
                                </div>
                                {/* Live Dropdown Desktop : Non-interactif pour focus input */}
                                {isSearching && <div className="absolute inset-x-0 top-full bg-white/90 backdrop-blur-sm rounded-b-xl p-2 text-black z-10">Recherche en cours...</div>}
                                {searchResults.length > 0 && (
                                    <div className="absolute inset-x-0 top-full bg-white shadow-lg rounded-b-xl max-h-80 overflow-y-auto z-10 pointer-events-none" tabIndex={-1}> {/* pointer-events-none : pas d'interférence focus */}
                                        {searchResults.map((product) => (
                                            <a
                                                key={product.id}
                                                href={productHref(product)}
                                                className="flex gap-3 p-3 hover:bg-gray-100 border-b last:border-b-0 block" // block pour liens
                                                onClick={() => dispatchSearchUpdate("")} // Clear après redirect single
                                            >
                                                <img
                                                    src={product.images?.[0]?.src || '/placeholder.jpg'}
                                                    alt={product.name}
                                                    className="w-12 h-12 object-cover rounded"
                                                    loading="lazy"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium truncate">{product.name}</h4>
                                                    {product.sku && <p className="text-sm text-gray-600">SKU: {product.sku}</p>}
                                                    <p className="text-sm text-gray-500 line-clamp-2">{product.description?.substring(0, 100)}...</p>
                                                </div>
                                            </a>
                                        ))}
                                        <a href={`${actionSearch}?s=${encodeURIComponent(headerSearchValue)}`} className="block p-3 text-center text-sm text-blue-600 hover:underline">Voir tous les résultats</a>
                                    </div>
                                )}
                            </form>

                            {/* Actions : Search button mobile caché quand ouvert */}
                            <div className="ml-auto flex items-center gap-1">
                                {/* Search Mobile Button : Caché si ouvert */}
                                <button
                                    className={`md:hidden inline-flex items-center rounded-full p-2 hover:bg-white/10 transition-opacity ${searchOpen ? 'opacity-0 hidden' : 'opacity-100'}`}
                                    onClick={() => setSearchOpen(true)}
                                    aria-label="Recherche produits"
                                >
                                    <SearchIcon className="h-6 w-6 text-white/80" />
                                </button>

                                {/* Mon Compte Mobile (après search, sans hamburger) */}
                                <button
                                    onClick={handleAccountClick}
                                    className="md:hidden inline-flex items-center rounded-full p-2 hover:bg-white/10"
                                >
                                    <UserIcon className="h-6 w-6 text-white/80" />
                                </button>

                                {/* Mon Compte Desktop */}
                                <button
                                    onClick={handleAccountClick}
                                    className="hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-2 hover:bg-white/10 hover:text-white transition"
                                >
                                    <UserIcon className="h-5 w-5 text-white/80" />
                                    <span>Mon compte</span>
                                </button>

                                {/* Panier */}
                                <a
                                    href={hrefCart}
                                    className="relative inline-flex items-center gap-2 rounded-full px-3 py-2 hover:bg-white/10 hover:text-white transition"
                                >
                                    <CartIcon className="h-5 w-5 text-white/80" />
                                    <span className="hidden sm:inline">Panier</span>
                                    <CartBadge />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Catégories Nav : Bouton "Tous" pour Offcanvas en mobile */}
                <div className="text-white/80 ring-1 ring-black/5" style={{ backgroundColor: BRAND.blue }}>
                    <div className="mx-auto max-w-7xl px-4">
                        <nav className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar">
                            {loadingCategories ? (
                                <SkeletonChips />
                            ) : (
                                top7.map((c) => (
                                    <a
                                        key={c?.slug ?? c?.term_id}
                                        href={catHref(c)}
                                        className="whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-white/10 hover:text-white transition"
                                    >
                                        {getCatLabel(c)}
                                    </a>
                                ))
                            )}
                            {sortedParents.length > 7 && (
                                <button
                                    type="button"
                                    onClick={() => setRayonsOpen(true)}
                                    className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-sm whitespace-nowrap hover:bg-white/15 md:px-3 md:py-1.5 md:text-base md:gap-2"
                                >
                                    <MenuIcon className="h-3 w-3 md:h-4 md:w-4 text-white/90" />
                                    <span className="hidden md:inline">Tous les rayons</span>
                                    <span className="md:hidden">Tous</span>
                                </button>
                            )}
                        </nav>
                    </div>
                    <div className="h-1 w-full" style={{ backgroundColor: `${BRAND.orange}CC` }} />
                </div>

                {/* Offcanvas : Passez props pour search sync */}
                <Offcanvas
                    open={rayonsOpen}
                    onClose={() => setRayonsOpen(false)}
                    includeSearch={true}
                    searchValue={headerSearchValue}
                    onSearchChange={onSearchInputChange}
                    onSearchSubmit={handleSearchSubmit}
                    searchResults={searchResults}
                    isSearching={isSearching}
                    categories={categories}
                    homeURL={homeURL}
                    searchInputRef={searchInputRef}
                />
            </header>

            <div style={{ height: HEADER_H }} aria-hidden="true" />
        </>
    );
}

/* Icônes */
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.8-4.8m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z" />
        </svg>
    );
}
function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.8" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    );
}
function CartIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2 12h10l2-8H7M9 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
        </svg>
    );
}
function UserIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.8" strokeLinecap="round" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm7 8a7 7 0 0 0-14 0" />
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