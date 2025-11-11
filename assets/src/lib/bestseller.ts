// assets/src/lib/bestseller.ts
import {
    addToCart,
    getCartLines,
    getCartUrl,
    CART_UPDATED_EVENT,
    type CartLine,
} from "./cart";

import { useState, useCallback, useEffect } from "react"; // Explicit pour hook

/* ---------- Types ---------- */
export type BestLiteRow = {
    id: number;
    slug: string;
    title: string;
    price: number;
    currency?: string;
    image?: string;
    permalink?: string;
    sku?: string;
};

export type FetchBestParams = {
    limit?: number;
    days?: number;
    category?: string;
    include_variations?: boolean;
};

/* ---------- API root ---------- */
function detectApiRoot(): string {
    const injected = typeof window !== "undefined" ? (window as any)?.BALL0U_API_BASE : "";
    if (typeof injected === "string" && injected.length) {
        return injected.replace(/\/$/, "");
    }
    if (typeof document !== "undefined") {
        const link = document.querySelector('link[rel="https://api.w.org/"]') as HTMLLinkElement | null;
        if (link?.href) return link.href.replace(/\/$/, "");
    }
    return "/wp-json";
}

const API_BASE = detectApiRoot();

/* ---------- Fetch best-sellers ---------- */
export async function fetchBestSellersLite(
    params: FetchBestParams = {}
): Promise<BestLiteRow[]> {
    const { limit = 12, days = 30, category, include_variations = false } = params;

    const qs = new URLSearchParams({
        limit: String(limit),
        days: String(days),
        include_variations: include_variations ? "1" : "0",
    });
    if (category) qs.set("category", category);

    const url = `${API_BASE}/site-info/v1/bestsellers-lite?${qs.toString()}`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) {
        console.error("fetchBestSellersLite failed", res.status, await res.text());
        return [];
    }
    const data = (await res.json()) as BestLiteRow[];
    return Array.isArray(data) ? data : [];
}

/* =========================================================================
   État cart partagé
   ========================================================================= */
let __cartLinesCache: CartLine[] | null = null;
let __cartCacheAt = 0;
const CART_CACHE_MS = 10000;

export async function getCartLinesCached(): Promise<CartLine[]> {
    const now = Date.now();
    if (__cartLinesCache && now - __cartCacheAt < CART_CACHE_MS) return __cartLinesCache;
    const lines = await getCartLines().catch(() => [] as CartLine[]);
    __cartLinesCache = lines;
    __cartCacheAt = now;
    console.log("[Bestsellers Cart] Cache refreshed:", lines.length, "lines");
    return lines;
}

export function useSharedCart(): { lines: CartLine[]; refreshCart: () => Promise<void>; loading: boolean } {
    const [lines, setLines] = useState<CartLine[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshCart = useCallback(async () => {
        setLoading(true);
        const fresh = await getCartLinesCached();
        setLines(fresh);
        setLoading(false);
        console.log("[Bestsellers Cart] Shared refresh:", fresh.length);
    }, []);

    useEffect(() => {
        refreshCart(); // Initial (1 fetch)
    }, [refreshCart]);

    useEffect(() => {
        const onUpdated = () => refreshCart();
        document.addEventListener(CART_UPDATED_EVENT, onUpdated);
        const onStorage = (e: StorageEvent) => {
            if (e.key === "ballou_cart_broadcast") onUpdated();
        };
        window.addEventListener("storage", onStorage);

        return () => {
            document.removeEventListener(CART_UPDATED_EVENT, onUpdated);
            window.removeEventListener("storage", onStorage);
        };
    }, [refreshCart]);

    // Safe return : lines toujours array
    return { lines, refreshCart, loading };
}

/** isProductInCart : Guard contre undefined/non-array */
export function isProductInCart(lines: CartLine[] | undefined, productId: number): boolean {
    if (!Array.isArray(lines) || lines.length === 0) {
        console.log("[Bestsellers] isInCart guard: lines invalid (", typeof lines, ")", lines?.length || 0, "→ false");
        return false;
    }
    const ok = lines.some((l) => l.id === productId && l.qty > 0);
    console.log("[Bestsellers] isInCart check for", productId, ":", ok, "(lines:", lines.length, ")");
    return ok;
}

/** addBestToCart + refresh */
export async function addBestToCart(productId: number, qty = 1, onRefresh?: () => void): Promise<void> {
    await addToCart(productId, qty);
    __cartLinesCache = null;
    if (onRefresh) onRefresh();
}

/** URL */
export function viewCartUrl(): string {
    return getCartUrl();
}

/* =========================================================================
   Hook bouton (lit shared, guardé)
   ========================================================================= */
export function useCartButton(
    productId: number,
    sharedLines: CartLine[] | undefined, // Accept undefined pour guard
    refreshShared: () => Promise<void>
) {
    const [inCart, setInCart] = useState<boolean>(false);
    const cartUrl = viewCartUrl();

    // Sync from shared (guardé)
    useEffect(() => {
        const ok = isProductInCart(sharedLines, productId);
        setInCart(ok);
    }, [sharedLines, productId]);

    const add = useCallback(async (qty = 1) => {
        await addBestToCart(productId, qty, refreshShared);
        setInCart(true); // Optimistic
        console.log("[Bestsellers] Add optimistic for", productId);
    }, [productId, refreshShared]);

    return { inCart, add, cartUrl };
}