// assets/src/lib/site-info.ts
type WpListArgs = { [k: string]: string | number | boolean | undefined };

function siteBase(): string {
    const b = (window as any).__BALLOU__?.restBaseSite; // ✅ bonne global
    return (b && typeof b === "string") ? b.replace(/\/?$/, "/") : "/wp-json/site-info/v1/";
}

function qs(params?: WpListArgs): string {
    if (!params) return "";
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        sp.set(k, String(v));
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
}

/** Types de l'endpoint /oursselect */
export type OursSelectRow = {
    id: number | string;
    slug: string;
    title?: string;        // certains schémas renvoient 'name'
    name?: string;
    price: number | string;
    currency?: string;
    image?: string;
    images?: { src: string }[]; // fallback éventuel
    permalink?: string;
    href?: string;
    sku?: string;
};

export type FetchOursParams = {
    limit?: number;
    tag?: string;
    category?: string;
};

/** GET /oursselect */
export async function fetchOursSelect(params?: FetchOursParams): Promise<OursSelectRow[]> {
    const url = `${siteBase()}oursselect${qs(params)}`;
    const res = await fetch(url, { method: "GET", credentials: "same-origin" }); // ✅ cookies si besoin
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`Failed to fetch oursselect. ${res.status} ${body}`);
        return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

/** GET /product-categories */
export async function fetchProductCategories(params?: WpListArgs) {
    const url = `${siteBase()}product-categories${qs(params)}`;
    const res = await fetch(url, { method: "GET", credentials: "omit" });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to fetch product categories. ${res.status} ${body}`);
    }
    return res.json();
}

/** GET /bestcategories */
export async function fetchBestCategories(params?: WpListArgs) {
    const url = `${siteBase()}bestcategories${qs(params)}`;
    const res = await fetch(url, { method: "GET", credentials: "omit" });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to fetch bestcategories. ${res.status} ${body}`);
    }
    return res.json();
}