// assets/src/lib/checkout.ts
// Corrigé :
// - Ajoute/Expose fetchOptions (normalise payments/payment_gateways)
// - createOrder envoie X-WP-Nonce (defaultHeaders(true))
// - Redirige toujours vers /merci/?key=... (fallback ID si pas de key)
// - Timeouts + logs + retries
// - Exports individuels seulement (suppression duplicatas pour build Vite)

import { type CartLine } from "./cart";

// ---------- Types ----------
export type ShippingMethod = {
    id: string;
    label?: string;
    total?: number;
    method_id?: string;
    instance_id?: number;
    cost?: number;
    tax?: number;
    taxes?: Record<number, number>;
};

export type PaymentOption = {
    id: string;
    title: string;
    description: string;
    enabled: boolean;
    available?: boolean;
    icon?: string;
};

export type CheckoutOptions = {
    payments: PaymentOption[];
    shipping_methods: ShippingMethod[];
    currency: string;
};

export type CheckoutLine = {
    id: string;        // ex: '613_0'
    qty: number;
    unit_price?: number;
    product_id: number;   // >0
    variation_id?: number; // 0 si simple
    name?: string;
};

export type Address = {
    country: string;
    state?: string;
    postcode?: string;
    city?: string;
    address_1?: string;
    address_2?: string;
};

export type CheckoutTaxes = Record<number, number>; // {pid: tax_amount}

// ---------- Détection racine WP ----------
function detectWpApiRootNoSlash(): string {
    const w = window as any;

    // 1) Injection WP
    const fromWp = w?.wpApiSettings?.root;
    if (fromWp && /^https?:\/\//i.test(fromWp)) {
        return String(fromWp).replace(/\/+$/, "");
    }

    // 2) <link rel="https://api.w.org/">
    const link = document.querySelector('link[rel="https://api.w.org/"]') as HTMLLinkElement | null;
    if (link?.href) return String(link.href).replace(/\/+$/, "");

    // 3) Deviner depuis l’URL: http://localhost/ballou/...
    try {
        const here = new URL(window.location.href);
        const segs = here.pathname.split("/").filter(Boolean);
        if (segs.length > 0) {
            const guessed = `${here.origin}/${segs[0]}/wp-json`.replace(/\/+$/, "");
            console.log("[API Root] Guessed from path:", guessed);
            return guessed;
        }
    } catch { /* noop */ }

    // 4) Fallback
    const fallback = `${window.location.origin}/wp-json`;
    console.warn("[API Root] Fallback to:", fallback);
    return fallback;
}

const WP_API_ROOT = detectWpApiRootNoSlash();                 // .../wp-json
function apiBase(): string { return `${WP_API_ROOT}/ballou/v1`; } // .../wp-json/ballou/v1
function wcApiBase(): string { return `${WP_API_ROOT}/wc/v3`; }   // .../wp-json/wc/v3

// Racine site (ex: http://localhost/ballou/)
function siteBaseFromWpRoot(): string {
    const u = new URL(`${WP_API_ROOT}/`);
    const sitePath = u.pathname.replace(/\/wp-json\/?$/i, "/");
    return `${u.origin}${sitePath}`;
}

// ---------- Headers/Helpers ----------
function defaultHeaders(auth = false): HeadersInit {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) {
        const nonce = (window as any)?.wpApiSettings?.nonce || (window as any)?.__BALLOU__?.nonce;
        if (nonce) headers["X-WP-Nonce"] = String(nonce);
    }
    return headers;
}

async function parseError(res: Response, fallback: string): Promise<never> {
    let msg = `${fallback} (HTTP ${res.status})`;
    try {
        const data = await res.json();
        if (data?.message) msg = data.message;
        if (data?.code) msg += ` [${data.code}]`;
    } catch {
        try {
            const txt = await res.text();
            if (txt) msg = `${msg} — ${txt.slice(0, 300)}`;
        } catch { /* ignore */ }
    }
    throw new Error(msg);
}

function parseProductIdFromKey(id: string): number {
    if (typeof id === "string" && id.includes("_")) {
        const parts = id.split("_");
        return Number(parts[0]) || 0;
    }
    return Number(id) || 0;
}

// ---------- loadCartLines : GET /ballou/v1/cart/lines ----------
export async function loadCartLines(retries = 0): Promise<CheckoutLine[]> {
    let localLines: CheckoutLine[] = [];
    try {
        const stored = localStorage.getItem("ballou_cart");
        if (stored) {
            localLines = JSON.parse(stored);
            console.log("[Checkout Load] Local lines count:", localLines.length);
        }
    } catch (e) {
        console.warn("[Checkout Load] Local parse error:", e);
    }

    try {
        const url = `${apiBase()}/cart/lines`;
        console.log("[Checkout Load] Fetching:", url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal, credentials: "include" });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Cart fetch failed: ${res.status}`);

        const data = await res.json();
        const apiItems = Array.isArray(data?.lines) ? data.lines : Array.isArray(data) ? data : [];
        console.log("[Checkout Load] Raw API lines:", apiItems.length, apiItems.slice(0, 2));

        const validLines: CheckoutLine[] = apiItems
            .filter((item: any) => item && item.qty > 0 && (item.id || item.key || item.cookie_id))
            .map((item: any) => {
                const key = String(item.id || item.key || item.cookie_id);
                const prodIdFromItem = Number(item.product_id || item.product?.id || parseProductIdFromKey(key) || 0);
                const prodId = prodIdFromItem > 0 ? prodIdFromItem : parseProductIdFromKey(key);
                if (prodId <= 0) console.warn("[Checkout Load] Invalid product_id for item:", key, item);
                return {
                    id: key,
                    qty: Number(item.qty || 0),
                    unit_price: Number(item.unit_price || 0),
                    product_id: prodId,
                    variation_id: Number(item.variation_id || 0),
                    name: item.product?.name || `Produit ${prodId}`,
                };
            })
            .filter((l: CheckoutLine) => l.id.length > 0 && l.qty > 0 && l.product_id > 0);

        console.log(
            "[Checkout Load] Filtered lines:",
            validLines.length,
            validLines.map((l) => ({ id: l.id, product_id: l.product_id, variation_id: l.variation_id, qty: l.qty }))
        );

        if (validLines.length > 0) {
            localStorage.setItem("ballou_cart", JSON.stringify(validLines));
            return validLines;
        } else if (localLines.length > 0 && retries < 3) {
            console.warn(`[Checkout Load] API empty, fallback local (retry ${retries + 1}/3)`);
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 500));
            return loadCartLines(retries + 1);
        } else {
            throw new Error("No valid cart lines loaded (API + local empty)");
        }
    } catch (e: any) {
        console.error("[Checkout Load] Fetch error:", e.message);
        if (localLines.length > 0 && localLines.every(l => l.product_id > 0)) {
            console.warn("[Checkout Load] Using local fallback after error");
            return localLines;
        }
        throw new Error(`Cart load failed: ${e.message}`);
    }
}

// ---------- Fallback prix produit ----------
export async function fetchProductPrice(id: number): Promise<number> {
    try {
        const url = `${wcApiBase()}/products/${id}`;
        const headers = defaultHeaders(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, { headers, signal: controller.signal, credentials: "include" });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Product ${id} failed: ${res.status}`);
        const data = await res.json();
        return Number(data?.price || 0);
    } catch (e: any) {
        console.warn("[Checkout Price] ID", id, ":", e.message);
        return 0;
    }
}

// ---------- fetchOptions : GET /ballou/v1/checkout/options ----------
export async function fetchOptions(billing: Address, lines: CheckoutLine[]): Promise<CheckoutOptions> {
    if (!lines || lines.length === 0 || lines.every(l => l.product_id <= 0)) {
        throw new Error("Empty or invalid lines – cannot fetch options");
    }

    const linesParam = lines.map((l) => `${l.product_id}:${l.qty}`).join(",");
    const qs = new URLSearchParams({
        country: billing.country,
        postcode: billing.postcode || "",
        city: billing.city || "",
        address_1: billing.address_1 || "",
        address_2: billing.address_2 || "",
        state: billing.state || "",
        lines: linesParam,
    });

    const url = `${apiBase()}/checkout/options?${qs.toString()}`;
    console.log("[Options API] URL:", url, "(lines count:", lines.length, ", ex: lines=", linesParam.slice(0, 50) + "... )");

    let retries = 0;
    while (retries < 3) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: defaultHeaders(false),
            credentials: "include",
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();

            const rawPayments = Array.isArray(data.payments)
                ? data.payments
                : Array.isArray(data.payment_gateways)
                    ? data.payment_gateways
                    : [];

            const payments: PaymentOption[] = rawPayments.map((g: any) => ({
                id: String(g.id),
                title: String(g.title || ""),
                description: String(g.description || ""),
                enabled: typeof g.enabled === "boolean" ? g.enabled : true,
                available: typeof g.available === "boolean" ? g.available : undefined,
                icon: typeof g.icon === "string" ? g.icon : undefined,
            }));

            console.log("[Options API] Response (normalized):", {
                raw_payments_len: rawPayments.length,
                normalized_payments_len: payments.length,
                shipping_len: Array.isArray(data.shipping_methods) ? data.shipping_methods.length : 0,
                currency: data.currency,
            });

            return {
                payments,
                shipping_methods: data.shipping_methods || [],
                currency: data.currency || "MGA",
            };
        }

        if (res.status >= 500) {
            retries++;
            console.warn(`[Options] Server error ${res.status}, retry ${retries}/3`);
            await new Promise((r) => setTimeout(r, 1000 * retries));
            continue;
        }
        await parseError(res, "Options fetch failed");
    }

    throw new Error("Options failed after retries (check lines product_id >0)");
}

// ---------- createOrder : POST /ballou/v1/checkout ----------
export async function createOrder(params: {
    lines: CheckoutLine[];
    coupons: string[];
    billing: Address & { first_name: string; last_name: string; email: string; phone: string };
    shipping: Address | null;
    shipping_method: string;
    payment_method: string;
    taxes?: CheckoutTaxes;
    note?: string;
}): Promise<{ order_id: number; payment_url: string }> {
    const { lines, coupons, billing, shipping, shipping_method, payment_method, taxes, note } = params;

    const bodyLines = lines
        .filter((l) => l.qty > 0 && l.product_id > 0)
        .map((l) => ({
            product_id: l.product_id,
            variation_id: l.variation_id || 0,
            qty: l.qty,
        }));

    if (bodyLines.length === 0) {
        throw new Error("Aucune ligne valide pour la commande (product_id >0, qty>0) – vérifiez le panier");
    }

    const body: any = {
        lines: bodyLines,
        coupons,
        address: {
            first_name: billing.first_name,
            last_name: billing.last_name,
            email: billing.email,
            phone: billing.phone || "",
            company: (billing as any).company || "",
            country: billing.country,
            state: billing.state || "",
            postcode: billing.postcode || "",
            city: billing.city || "",
            address_1: billing.address_1 || "",
            address_2: billing.address_2 || "",
        },
        shipping_method,
        payment_method,
        totals: {
            subtotal: 0,
            tax: taxes ? Object.values(taxes).reduce((a, b) => a + b, 0) : 0,
            shipping: 0,
            discount: 0,
            total: 0,
        },
    };
    if (shipping && (shipping.country !== billing.country || shipping.city !== billing.city)) {
        body.shipping_address = shipping;
    }
    if (note && note.trim()) body.note = note.trim().substring(0, 500);

    const url = `${apiBase()}/checkout`;
    console.log("[Create API] POST /checkout, lines count:", body.lines.length, "URL:", url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: defaultHeaders(true),           // <<--- important: X-WP-Nonce
        credentials: "include",
        body: JSON.stringify(body),
    });
    clearTimeout(timeoutId);

    if (!res.ok) await parseError(res, "Création commande échouée");

    const data = await res.json();
    console.log("[Create API] Success:", {
        order_id: data?.order_id,
        payment_url: data?.payment_url,
        order_key: data?.order_key,
    });

    const siteBase = siteBaseFromWpRoot(); // ex: http://localhost/ballou/
    let finalUrl = "";

    // 1) Utiliser prioritairement la clé (lien /merci)
    let orderId = Number(data?.order_id || 0);
    let orderKey = String(data?.order_key || "");

    // 2) Si pas de key, tenter d’extraire depuis payment_url (order-pay)
    if (!orderKey && typeof data?.payment_url === "string") {
        try {
            const u = new URL(data.payment_url);
            const k = u.searchParams.get("key");
            if (k && k.startsWith("wc_order_")) orderKey = k;
            const idFromPath = u.pathname.match(/\/(\d+)\//)?.[1];
            if (!orderId && idFromPath) orderId = Number(idFromPath);
        } catch { /* noop */ }
    }

    // 3) Construire l’URL merci
    if (orderKey) {
        finalUrl = `${siteBase}merci/?key=${encodeURIComponent(orderKey)}`;
    } else if (orderId) {
        finalUrl = `${siteBase}merci/${orderId}/`;
    } else {
        finalUrl = `${siteBase}mon-compte/commandes`;
    }

    return { order_id: orderId || 0, payment_url: finalUrl };
}
