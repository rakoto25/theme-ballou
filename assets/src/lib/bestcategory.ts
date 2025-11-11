export type BestCatRow = {
    id: number;
    slug: string;
    name: string;
    count: number;
    permalink: string;
};

export type FetchBestCatParams = {
    limit?: number;                       // défaut 10
    orderby?: "name" | "count" | "slug";  // défaut 'name'
    order?: "ASC" | "DESC";               // défaut 'ASC'
};

const API_BASE =
    (typeof window !== "undefined" && (window as any).BALL0U_API_BASE) || "/wp-json";

export async function fetchBestCategories(
    params: FetchBestCatParams = {}
): Promise<BestCatRow[]> {
    const {
        limit = 10,
        orderby = "name",
        order = "ASC",
    } = params;

    const qs = new URLSearchParams({
        limit: String(limit),
        orderby,
        order,
    });

    const url = `${API_BASE}/site-info/v1/bestcategories?${qs.toString()}`;
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) {
        console.error("fetchBestCategories failed", res.status, await res.text());
        return [];
    }
    const data = (await res.json()) as BestCatRow[];
    return Array.isArray(data) ? data : [];
}