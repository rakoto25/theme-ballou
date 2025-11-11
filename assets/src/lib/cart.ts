// lib/cart.ts - Cookie-based (/ballou/v1/cart/*), id=string key, types TTC

/** ---------- Types ---------- */
export type CartLine = {
    id: string;   // cart_item_key string ex: '613_0' (depuis cookie)
    qty: number;
    product_id?: number;  // ID produit Woo
};

export type CartAddress = {
    country: string;
    postcode?: string;
    city?: string;
    address_1?: string;
    address_2?: string;
    company?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
};

export type CartQuoteItem = {
    id: number;                 // product_id (number)
    key?: string;               // cart_item_key (string)
    cookie_id?: string;         // Alias pour key
    qty: number;
    unit_price: number;         // Prix unitaire TTC
    line_total: number;         // Ligne totale TTC
    line_tax?: number;
    available: boolean;
    max_qty: number | null;
    product: {
        id: number;
        name: string;
        permalink?: string;
        price?: string | number;
        images?: { src: string; alt?: string }[];
    };
    variation_id?: number;
};

export type CartQuoteTotals = {
    subtotal_ex_tax: number;    // HT (fallback)
    subtotal?: number;          // TTC si backend l’inclut
    discount_ex_tax: number;
    discount?: number;          // TTC
    items_tax: number;
    shipping_total: number;
    shipping_tax: number;
    tax_total: number;
    total: number;              // Total TTC
    currency: string;
};

export type CartQuoteResponse = {
    items: CartQuoteItem[];
    currency: string;
    totals: CartQuoteTotals;
    applied_coupons: { code: string; valid: boolean; amount?: string; type?: string }[];
    shipping_methods: { id: string; label: string; total: number }[];
    chosen_shipping_method: string | null;
};

/* ------------------------------------------------------------------ */
/* API configuration – compatible site installé dans /ballou          */
/* ------------------------------------------------------------------ */

/**
 * Détecte la racine REST WP (termine par /wp-json/).
 * Ordre:
 * 1) window.wpApiSettings.root (fiable)
 * 2) <link rel="https://api.w.org/" href="...">
 * 3) Fallback: origin + "/ballou/wp-json/" si on devine le dossier depuis location.pathname
 * 4) Dernier recours: origin + "/wp-json/"
 */
function detectWpApiRoot(): string {
    const w = window as any;

    // 1) Injection WP
    const fromWp = w?.wpApiSettings?.root;
    if (fromWp && /^https?:\/\//i.test(fromWp)) return String(fromWp);

    // 2) Balise link
    const link = document.querySelector('link[rel="https://api.w.org/"]') as HTMLLinkElement | null;
    if (link?.href) return String(link.href);

    // 3) Deviner le dossier depuis l’URL page (utile pour WAMP www/ballou)
    // Exemple: http://localhost/ballou/...
    try {
        const here = new URL(window.location.href);
        // On prend le premier segment non vide comme dossier app (ex: "ballou")
        const segs = here.pathname.split('/').filter(Boolean);
        if (segs.length > 0) {
            const rootGuess = `${here.origin}/${segs[0]}/wp-json/`;
            return rootGuess;
        }
    } catch { /* ignore */ }

    // 4) Fallback générique
    return `${window.location.origin}/wp-json/`;
}

// Racine API WP (généralement .../wp-json/)
const WP_API_ROOT = detectWpApiRoot().replace(/\/+$/, '/') as const;

// Base API de notre namespace plugin
const API_BASE = `${WP_API_ROOT.replace(/\/$/, "")}/ballou/v1/` as const;

const DEBUG: boolean = !!(window as any).__BALLOU_DEBUG__;
function dlog(...args: any[]) { if (DEBUG) console.log(...args); }

async function safeJson<T = any>(res: Response): Promise<T> {
    const txt = await res.text();
    try {
        return JSON.parse(txt) as T;
    } catch {
        // WordPress peut renvoyer du HTML en cas d’erreur PHP/maintenance
        if (/<!DOCTYPE|<html/i.test(txt)) throw new Error("Réponse non-JSON (HTML)");
        const s = txt.indexOf("{");
        const e = txt.lastIndexOf("}");
        if (s >= 0 && e > s) {
            try { return JSON.parse(txt.slice(s, e + 1)) as T; } catch { /* fallthrough */ }
        }
        throw new Error("Réponse JSON invalide");
    }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Helpers pour matching
export function getCookieId(item: CartQuoteItem): string {
    return item.key || item.cookie_id || `${item.id}_${item.variation_id || 0}`;
}

export function getProductId(item: CartQuoteItem): string {
    return String(item.id || 0);
}

function parseProductIdFromKey(id: string): number {
    if (typeof id === 'string' && id.includes('_')) {
        const parts = id.split('_');
        return Number(parts[0]) || 0;
    }
    return Number(id) || 0;
}

/* ------------------------------------------------------------------ */
/* Woo Product fetch (catalog info)                                   */
/* ------------------------------------------------------------------ */

export async function fetchProduct(id: number, retry = false): Promise<any | null> {
    if (!Number.isFinite(id) || id <= 0) {
        dlog(`[Cart Debug] Skip fetch invalid product ID: ${id}`);
        return null;
    }

    try {
        // Construire la racine /wc/v3/ à partir de WP_API_ROOT (…/wp-json/)
        // Exemple: http://localhost/ballou/wp-json/  ->  http://localhost/ballou/wp-json/wc/v3/
        const wcApiRoot = `${WP_API_ROOT}wc/v3/`;
        // Si WP injecte un nonce, l’utiliser
        const nonce = (window as any).wpApiSettings?.nonce;
        const headers: HeadersInit = nonce ? { 'X-WP-Nonce': nonce } : {};
        const url = `${wcApiRoot}products/${id}`;

        dlog(`[Cart Debug] Fetching product ${id} from ${url}`);

        const response = await fetch(url, { headers, credentials: 'include' });

        if (response.status === 404) {
            if (!retry) {
                dlog(`[Cart Debug] Product ${id} 404 (first try), retrying...`);
                await new Promise(r => setTimeout(r, 500));
                return fetchProduct(id, true);
            } else {
                console.warn(`[Cart Debug] Product ${id} not found (404 after retry)`);
                return null;
            }
        }

        if (!response.ok) {
            console.warn(`[Cart Debug] Product ${id} fetch failed: ${response.status} ${response.statusText}`);
            return null;
        }

        const product = await response.json();
        const result = {
            id: product.id,
            name: product.name || `Produit ${id}`,
            price: parseFloat(product.price || '0'),
            regular_price: parseFloat(product.regular_price || '0'),
            images: product.images || [],
            permalink: product.permalink || `/produit/${id}`,
            stock_quantity: product.stock_quantity || null,
        };

        if (result.price <= 0) {
            console.warn(`[Cart Debug] Product ${id} fetched but price=0 (check Woo pricing)`);
        } else {
            dlog(`[Cart Debug] Product ${id} fetched: ${result.name} @ ${result.price} MGA`);
        }

        return result;
    } catch (e: any) {
        console.warn(`[Cart Debug] Fetch product ${id} failed:`, e.message || e);
        return null;
    }
}

/* ------------------------------------------------------------------ */
/* Events                                                             */
/* ------------------------------------------------------------------ */

export const CART_UPDATED_EVENT = "ballou:cart:updated";

export function emitCartUpdated() {
    try { document.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT)); } catch { /* noop */ }
    try { window.localStorage.setItem("ballou_cart_broadcast", String(Date.now())); } catch { /* noop */ }
}

/** Construit /panier/ depuis WP_API_ROOT (robuste pour http://localhost/ballou/) */
export function getCartUrl(): string {
    // WP_API_ROOT est .../ballou/wp-json/ → on retire le suffixe /wp-json/ pour retrouver la base site
    const u = new URL(WP_API_ROOT);
    const siteBasePath = u.pathname.replace(/\/wp-json\/?$/, "/");  // "/ballou/"
    return `${u.origin}${siteBasePath}panier/`;
}

/* ------------------------------------------------------------------ */
/* API Panier (rest_cart.php cookie-based)                            */
/* ------------------------------------------------------------------ */

export async function addToCart(id: number, qty = 1, emitAfter?: boolean): Promise<void> {
    const before = await getCartLines().catch(() => [] as CartLine[]);
    dlog("[Cart Debug] before add (id:", id, "):", before);

    const existing = before.find((l) => l.product_id === id || parseProductIdFromKey(l.id) === id)?.qty || 0;
    const nextQty = Math.max(1, existing + qty);

    dlog("[Cart Debug] Adding/updating id:", id, "to qty:", nextQty);

    const res = await fetch(`${API_BASE}cart/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        body: JSON.stringify({ id, qty: nextQty }),
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`addToCart/update failed: ${res.status} ${txt}`);
    }

    const after = await getCartLines().catch(() => [] as CartLine[]);
    dlog("[Cart Debug] after add (id:", id, "):", after);

    if (typeof emitAfter === 'undefined' || emitAfter) {
        setTimeout(() => emitCartUpdated(), 300);
    }
}

/** Une seule getCartLines – cookie-based (/ballou/v1/cart/lines), id=string key, product_id=number */
export async function getCartLines(retryCount = 0): Promise<CartLine[]> {
    const maxRetries = 2;
    const url = `${API_BASE}cart/lines`;
    dlog("[Cart Debug] fetching lines from", url, "(retry:", retryCount, "/", maxRetries, ")");

    let res: Response;
    try {
        res = await fetch(url, { credentials: "include" });
    } catch (e: any) {
        if (retryCount < maxRetries && e instanceof TypeError) {
            dlog("[Cart Debug] Network error, retrying...", e);
            await new Promise(r => setTimeout(r, 200 * (retryCount + 1)));
            return getCartLines(retryCount + 1);
        }
        throw e;
    }

    dlog("[Cart Debug] fetch lines status:", res.status);
    if (!res.ok) return [];

    const data = (await res.json().catch(() => ({} as any))) as any;
    dlog("[Cart Debug] lines payload:", data);

    // rest_cart.php → {lines: [{id/key/cookie_id, product_id, qty, ...}]}
    const raw = Array.isArray((data as any)?.lines) ? (data as any).lines : (Array.isArray(data) ? data : []);

    const lines: CartLine[] = raw
        .map((l: any) => {
            const key = l.key || l.cart_item_key || l.cookie_id || String(l.id);
            let productId: number;
            if (l.product_id) {
                productId = Number(l.product_id);
            } else {
                productId = parseProductIdFromKey(key);
            }
            return {
                id: key,  // String key exact match
                qty: Number(l.qty ?? l.quantity ?? 0),
                product_id: productId > 0 ? productId : undefined,
            };
        })
        .filter((l: CartLine) => l.id && Number.isFinite(l.qty) && l.qty > 0);

    dlog("[Cart Debug] parsed lines:", lines.map(l => ({ id: l.id, product_id: l.product_id, qty: l.qty })));

    if (lines.length > 0) {
        localStorage.setItem('ballou_cart', JSON.stringify(lines));
        dlog("[Cart Debug] Saved to local:", lines.length);
    } else {
        localStorage.removeItem('ballou_cart');
    }

    document.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: { lines } }));
    return lines;
}

/** Récupère items complets (name/price TTC/images) depuis /cart/lines */
export async function getCartItems(): Promise<CartQuoteItem[]> {
    const url = `${API_BASE}cart/lines`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
        dlog("[Cart Debug] getCartItems failed:", res.status);
        return [];
    }
    const data = await safeJson<{ lines: any[] }>(res);
    const raw = Array.isArray(data?.lines) ? data.lines : [];

    const items: CartQuoteItem[] = raw
        .filter((item: any) => item && item.qty > 0 && (item.id || item.key || item.cookie_id))
        .map((item: any) => ({
            id: Number(item.product_id || item.id || 0),
            key: String(item.id || item.key || item.cookie_id || ''),
            cookie_id: String(item.cookie_id || item.key || item.id || ''),
            qty: Number(item.qty || 0),
            unit_price: Number(item.unit_price || 0),
            line_total: Number(item.line_total || (Number(item.unit_price || 0) * Number(item.qty || 0))),
            line_tax: Number(item.line_tax || 0),
            available: item.available !== false,
            max_qty: item.max_qty ?? null,
            product: item.product || {
                id: item.product_id || item.id,
                name: `Produit ${item.product_id || item.id}`,
                permalink: '',
                price: 0,
                images: [],
            },
            variation_id: Number(item.variation_id || 0),
        }))
        .filter((item) => item.id > 0);

    dlog("[Cart Debug] getCartItems:", items.map(i => ({ id: i.id, name: i.product.name, price: i.unit_price })));
    return items;
}

export async function getCartCount(): Promise<number> {
    const res = await fetch(`${API_BASE}cart/count`, { credentials: "include" });
    if (!res.ok) return 0;
    const json = (await res.json().catch(() => ({}))) as any;
    return Number(json?.count || 0);
}

export async function updateCartLine(id: string, qty: number, emitAfter?: boolean, abortSignal?: AbortSignal) {
    dlog("[Cart Debug] Updating line key:", id, "to qty:", qty);

    const res = await fetch(`${API_BASE}cart/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        signal: abortSignal,
        body: JSON.stringify({ id, qty }),
    });
    if (!res.ok) throw new Error("Échec mise à jour panier");

    const after = await getCartLines().catch(() => [] as CartLine[]);
    dlog("[Cart Debug] after update (id:", id, "):", after);

    if (typeof emitAfter === 'undefined' || emitAfter) {
        setTimeout(() => emitCartUpdated(), 300);
    }
}

export async function removeCartLine(id: string, emitAfter?: boolean, abortSignal?: AbortSignal) {
    dlog("[Cart Debug] Removing line key:", id);

    const res = await fetch(`${API_BASE}cart/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        signal: abortSignal,
        body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error("Échec suppression article");

    const after = await getCartLines().catch(() => [] as CartLine[]);
    dlog("[Cart Debug] after remove (id:", id, "):", after);

    if (typeof emitAfter === 'undefined' || emitAfter) {
        setTimeout(() => emitCartUpdated(), 300);
    }
}

/** fetchCartQuote : POST /cart/quote (body.lines = [{id(key), qty}]) */
export async function fetchCartQuote(input: {
    lines?: CartLine[];
    coupons?: string[];
    address?: CartAddress;
    shipping_method?: string;
    abortSignal?: AbortSignal;
}): Promise<CartQuoteResponse> {
    const body: any = {};
    if (input.lines !== undefined) {
        body.lines = (input.lines || []).map(l => ({ id: l.id, qty: l.qty }));  // id=string key
        dlog("[Cart Debug] fetchQuote: sending lines=", body.lines.length);
    } else {
        dlog("[Cart Debug] fetchQuote: lines omis → PHP read cookie");
    }
    if (input.coupons) body.coupons = input.coupons;
    if (input.address) body.address = input.address;
    if (input.shipping_method !== undefined) body.shipping_method = input.shipping_method;

    const res = await fetch(`${API_BASE}cart/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        signal: input.abortSignal,
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Échec calcul du panier");

    const q = await safeJson<CartQuoteResponse>(res);

    // Anti-fantôme : si client lines=0 mais serveur items>0 → renvoyer vide (cohérence visuelle)
    const clientLinesEmpty = input.lines === undefined || (Array.isArray(input.lines) && input.lines.length === 0);
    const serverItemsCount = Array.isArray(q?.items) ? q.items.length : 0;
    if (clientLinesEmpty && serverItemsCount > 0) {
        dlog("[Cart Debug] Anti-fantôme fetchQuote: force empty (client lines empty, server items>", serverItemsCount, ")");
        const currency = q?.currency || "MGA";
        return {
            items: [],
            currency,
            totals: q?.totals || {
                subtotal_ex_tax: 0, subtotal: 0, discount_ex_tax: 0, discount: 0, items_tax: 0,
                shipping_total: 0, shipping_tax: 0, tax_total: 0,
                total: 0, currency,
            },
            applied_coupons: [],
            shipping_methods: [],
            chosen_shipping_method: null,
        };
    }

    dlog("[Cart Debug] fetchQuote response:", {
        items: q.items.length,
        totals: { subtotal: q.totals.subtotal ?? q.totals.subtotal_ex_tax, total: q.totals.total }
    });
    return q;
}

/** fetchCartQuoteSmart : Strict (toujours avec lines) */
export async function fetchCartQuoteSmart(input: {
    lines: CartLine[];
    coupons?: string[];
    address?: CartAddress;
    shipping_method?: string;
    abortSignal?: AbortSignal;
}): Promise<CartQuoteResponse> {
    const body = {
        lines: (input.lines || []).map(l => ({ id: l.id, qty: l.qty })),  // id=string
        coupons: input.coupons || [],
        address: input.address || undefined,
        shipping_method: input.shipping_method || undefined,
    };

    const res = await fetch(`${API_BASE}cart/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        signal: input.abortSignal,
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("Échec du calcul du panier");

    const q = await safeJson<CartQuoteResponse>(res);

    const clientCount = body.lines.length;
    const serverCount = Array.isArray(q?.items) ? q.items.length : 0;

    if (clientCount === 0 && serverCount > 0) {
        const currency = q?.currency || "MGA";
        return {
            items: [],
            currency,
            totals: q?.totals || {
                subtotal_ex_tax: 0, subtotal: 0, discount_ex_tax: 0, discount: 0, items_tax: 0,
                shipping_total: 0, shipping_tax: 0, tax_total: 0,
                total: 0, currency,
            },
            applied_coupons: [],
            shipping_methods: [],
            chosen_shipping_method: null,
        };
    }

    return q;
}

/** fetchCartQuoteFast : Mode FAST avec abort (id=string) */
let quoteAbort: AbortController | null = null;

export async function fetchCartQuoteFast(
    lines: CartLine[],
    coupons?: string[],
    address?: CartAddress
): Promise<CartQuoteResponse> {
    if (quoteAbort) quoteAbort.abort();
    quoteAbort = new AbortController();

    const body = {
        fast: true,
        lines: lines.map(l => ({ id: l.id, qty: l.qty })),  // id=string
        coupons,
        address
    };

    const res = await fetch(`${API_BASE}cart/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        credentials: "include",
        signal: quoteAbort.signal,
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("Échec du devis rapide");

    const q = await safeJson<CartQuoteResponse>(res);

    const clientCount = lines.length;
    const serverCount = Array.isArray(q?.items) ? q.items.length : 0;

    if (clientCount === 0 && serverCount > 0) {
        dlog("[Cart Debug] Anti-fantôme fast: force empty quote (client lines=0, server items>0)");
        const currency = q?.currency || "MGA";
        return {
            items: [],
            currency,
            totals: {
                subtotal_ex_tax: 0, subtotal: 0, discount_ex_tax: 0, discount: 0, items_tax: 0,
                shipping_total: 0, shipping_tax: 0, tax_total: 0,
                total: 0, currency,
            },
            applied_coupons: [],
            shipping_methods: [],
            chosen_shipping_method: null,
        };
    }

    return q;
}

export function cancelFastQuoteInFlight() {
    if (quoteAbort) {
        try { quoteAbort.abort(); } catch { /* noop */ }
        quoteAbort = null;
    }
}


/** Construit /validation-de-commande/ depuis WP_API_ROOT (robuste) */
export function getCheckoutUrl(): string {
    const u = new URL(WP_API_ROOT);
    const siteBasePath = u.pathname.replace(/\/wp-json\/?$/, "/"); // "/ballou/" ou "/"
    // ⚠️ adapte le slug si ton WordPress utilise un autre permalien (ex: "commande" ou "checkout")
    return `${u.origin}${siteBasePath}validation-de-commande/`;
}
/* ------------------------------------------------------------------ */
/* Internal exports                                                   */
/* ------------------------------------------------------------------ */
export const __INTERNAL = { API_BASE, WP_API_ROOT };