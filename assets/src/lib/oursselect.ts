export type OursSelectRow = {
    id: number;
    slug: string;
    title: string;
    price: number;
    currency?: string;
    image?: string;
    permalink?: string;
    sku?: string;
};

export type FetchOursParams = {
    limit?: number;
    tag?: string;        // product_tag slug (par défaut: selection-du-mois)
    category?: string;   // product_cat slug (optionnel)
};

const API_BASE =
    (typeof window !== "undefined" && (window as any).BALL0U_API_BASE) || "/wp-json";

export async function fetchOursSelect(params: FetchOursParams = {}): Promise<OursSelectRow[]> {
    const { limit = 12, tag = "selection-du-mois", category } = params;

    const qs = new URLSearchParams({
        limit: String(limit),
        tag: String(tag || ""),
    });
    if (category) qs.set("category", category);

    const url = `${API_BASE}/site-info/v1/oursselect?${qs.toString()}`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) {
        console.error("fetchOursSelect failed", res.status, await res.text());
        return [];
    }
    const data = (await res.json()) as OursSelectRow[];
    return Array.isArray(data) ? data : [];
}