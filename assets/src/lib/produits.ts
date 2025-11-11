// assets/src/lib/produits.ts
export type FetchProductsParams = {
    search?: string;
    categories?: string[];  // slugs
    min_price?: number;
    max_price?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
    orderby?: "date" | "price" | "title" | "popularity" | string;
    order?: "ASC" | "DESC" | string;
    min_stock?: number;     // supporté par ton PHP
};

export type FetchProductsItem = {
    id: number;
    title: string;
    image: string;
    category: string;
    ref?: string;
    price: number;
    currency: string;
    permalink: string;
};

export type FetchProductsResp = {
    items: FetchProductsItem[];
    total: number;
    total_pages: number;
    min_price: number;
    max_price: number;
    categories: Array<{ slug: string; name: string } | string>;
    currency: string;
};

function siteBase(): string {
    // Injecté par vite.php : window.__BALLOU__.restBaseSite = "<site>/wp-json/site-info/v1/"
    const b = (window as any).__BALLOU__?.restBaseSite;
    return b && typeof b === "string" ? b.replace(/\/?$/, "/") : "/wp-json/site-info/v1/";
}

function qs(params?: Record<string, string | number | boolean | undefined>): string {
    if (!params) return "";
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        sp.set(k, String(v));
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
}

async function jsonOrThrow(res: Response, label: string) {
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${label}: ${res.status} ${body}`);
    }
    return res.json();
}

/** GET /site-info/v1/products */
export async function fetchProducts(input: FetchProductsParams): Promise<FetchProductsResp> {
    const { categories, ...rest } = input || {};
    const params: Record<string, string | number | boolean | undefined> = { ...rest };
    if (Array.isArray(categories) && categories.length > 0) {
        params.categories = categories.join(","); // ton PHP attend un CSV
    }

    const url = `${siteBase()}products${qs(params)}`;
    const res = await fetch(url, { method: "GET", credentials: "omit" });
    return jsonOrThrow(res, "fetchProducts failed");
}

/** Utilitaire MGA */
export function fmtAr(n: number): string {
    const x = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("fr-MG", { maximumFractionDigits: 0 }).format(x) + " Ar";
}