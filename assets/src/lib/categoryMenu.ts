// assets/src/lib/categoryMenu.ts
export type ApiCategory = {
    term_id: number;
    slug: string;
    name: string;
    label?: string;
    count: number;
    count_sum?: number;
    permalink?: string;
    url?: string;
    children?: ApiCategory[];
};

export type MenuCategory = {
    id: number;
    label: string;
    name: string;
    slug: string;
    url: string; // URL archive Woo
    count: number;
    count_sum?: number;
    children: MenuCategory[];
};

/**
 * Récupère les catégories (parents + enfants) formatées pour le menu.
 * - Endpoint: /wp-json/site-info/v1/product-categories
 * - Utilise __BALLOU__.restBase si injecté côté PHP (recommandé),
 *   sinon BALL0U_API_BASE, sinon fallback générique.
 */
export async function getProductCategoriesForMenu(): Promise<MenuCategory[]> {
    // 1) Priorité: injection PHP (ex: http://localhost/ballou/wp-json/site-info/v1/)
    const injectedBase =
        (window as any).__BALLOU__?.restBase &&
        String((window as any).__BALLOU__.restBase);

    // 2) Sinon: racine API (ex: http://localhost/ballou/wp-json) + suffixe
    const apiBase =
        (window as any).BALL0U_API_BASE &&
        String((window as any).BALL0U_API_BASE).replace(/\/$/, "");

    // 3) Fallback absolu
    const fallbackBase = "/wp-json/site-info/v1/";

    const restBase =
        injectedBase ||
        (apiBase ? `${apiBase}/site-info/v1/` : fallbackBase);

    const endpoint = `${restBase}product-categories`;

    const res = await fetch(endpoint, { credentials: "same-origin" });
    if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Failed to fetch product categories. ${res.status} ${msg}`);
    }

    const cats = (await res.json()) as ApiCategory[] | unknown;
    if (!Array.isArray(cats)) return [];

    const isValid = (c: ApiCategory) => {
        const slug = (c.slug || "").toLowerCase();
        const name = (c.name || "").toLowerCase();
        return slug !== "uncategorized" && slug !== "non-classe" && !name.includes("non class");
    };

    const mapCat = (c: ApiCategory): MenuCategory => {
        const safeUrl =
            c.url?.toString() ||
            c.permalink?.toString() ||
            `/product-category/${encodeURIComponent(c.slug)}/`;

        return {
            id: Number(c.term_id || 0),
            label: c.name || c.label || c.slug || "Catégorie",
            name: c.name || c.label || c.slug || "Catégorie",
            slug: c.slug,
            url: safeUrl,
            count: typeof c.count === "number" ? c.count : 0,
            count_sum: typeof c.count_sum === "number" ? c.count_sum : undefined,
            children: Array.isArray(c.children) ? c.children.filter(isValid).map(mapCat) : [],
        };
    };

    return cats.filter(isValid).map(mapCat);
}