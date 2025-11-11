// assets/src/lib/utils.ts – MGA utils + mockT FR (langue française par défaut)

export function fmtMGA(num: number, decimals: number = 0): string {
    if (!Number.isFinite(num) || num < 0) return "0 Ar";
    const formatted = num.toLocaleString("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    return `${formatted} Ar`;
}

export function unfmtMGA(str: string | number | undefined | null): number {
    if (typeof str === "number") return str;
    if (!str || typeof str !== "string") return 0;
    const clean = str
        .replace(/Ar|ariary|MG/i, "")
        .replace(/[\s,]/g, "")
        .replace(/\./g, "");
    const num = parseFloat(clean);
    if (!Number.isFinite(num)) {
        console.warn("[Utils] unfmtMGA fail:", str);  // ⬅️ Debug pour prix N/A
        return 0;
    }
    return num;
}

export const DEBUG = !!(window as any).__BALLOU_DEBUG__;
export function dlog(...args: any[]): void {
    if (DEBUG) console.log("[Utils]", ...args);
}

export function mockT(key: string): string {
    // ⬅️ CHANGÉ: Map FR explicite (return FR ; supprimez EN pour full FR)
    const translations: Record<string, string> = {
        // Labels FR (même que clés pour cohérence)
        "Votre panier": "Votre panier",
        "article": "article",
        "articles": "articles",
        "Votre panier est vide.": "Votre panier est vide.",
        "Confirmer suppression ?": "Confirmer suppression ?",
        "Supprimer": "Supprimer",
        "Prix unitaire": "Prix unitaire",
        "Sous-total": "Sous-total",
        "produit": "produit",
        "produits": "produits",
        "Remise": "Remise",
        "Livraison": "Livraison",
        "Total TTC": "Total TTC",
        "Passer la commande": "Passer la commande",
        "Chargement...": "Chargement...",
        "Aucun article.": "Aucun article.",
        "Adresse": "Adresse",
        "Résumé": "Résumé",
        // Ajoutez pour autres: "Ajouter": "Ajouter", etc.
    };
    // Retourne FR value ou clé (toujours FR)
    return translations[key] || key;
}

export function useMockT(): (key: string) => string {
    return mockT;
}