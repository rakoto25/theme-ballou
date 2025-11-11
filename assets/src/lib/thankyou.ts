// assets/src/lib/thankyou.ts

export interface Address {
    address_1: string;
    address_2?: string;
    city: string;
    state?: string;
    postcode?: string;
    country: string;
}

export interface OrderItem {
    name: string;
    quantity: number;
    total: string; // TTC formaté pour affichage
    price: string; // Unitaire TTC formaté
}

export interface OrderShippingLine {
    method_title: string;
    total: string;
}

export interface OrderDetails {
    id: number;
    status: string;
    total: string; // TTC (nombre côté API; formaté ici)
    currency: string;
    date_created: string;
    billing: Address & {
        first_name: string;
        last_name: string;
        email: string;
        phone?: string;
    };
    shipping?: Address; // Optionnel (retrait local -> billing)
    items: OrderItem[];
    shipping_lines: OrderShippingLine[];
    payment_method: string;
    payment_method_title?: string;
}

/**
 * Format MGA robuste:
 * - Utilise NumberFormat en "decimal" (pas "currency") pour éviter les symboles/espaces exotiques
 * - Normalise TOUTES les variantes d'espaces insécables vers un espace ASCII ' '
 * - Fallback manuel si Intl indisponible
 */
export const fmtMGA = (n: string | number): string => {
    const cleaned = typeof n === "string" ? Number(n.replace(/[^\d.-]/g, "")) : Number(n);
    const v = Math.round(isFinite(cleaned) ? cleaned : 0);

    try {
        let s = new Intl.NumberFormat("fr-FR", {
            useGrouping: true,
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
        }).format(v);
        // Normalise espaces spéciaux (NBSP U+00A0, NNBSP U+202F, etc.)
        s = s.replace(/\u00A0|\u202F|\u2007|\u2060/g, " ");
        return `${s} Ar`;
    } catch {
        // Fallback manuel
        const sign = v < 0 ? "-" : "";
        const digits = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return `${sign}${digits} Ar`;
    }
};

// Détection de la base REST (mêmes priorités que côté checkout)
function getRestBase(): string {
    const w = window as any;

    // 1) Injection Vite (vite.php)
    const fromVite = w?.BALLOU_API_BASE;
    if (fromVite && /^https?:\/\//i.test(fromVite)) return String(fromVite).replace(/\/+$/, "");

    // 2) wpApiSettings.root
    const fromWp = w?.wpApiSettings?.root;
    if (fromWp && /^https?:\/\//i.test(fromWp)) return String(fromWp).replace(/\/+$/, "");

    // 3) <link rel="https://api.w.org/">
    const link = document.querySelector('link[rel="https://api.w.org/"]') as HTMLLinkElement | null;
    if (link?.href) return String(link.href).replace(/\/+$/, "");

    // 4) Deviner à partir du path courant (utile en WAMP: /ballou/wp-json)
    try {
        const here = new URL(window.location.href);
        const segs = here.pathname.split("/").filter(Boolean);
        if (segs.length > 0) {
            return `${here.origin}/${segs[0]}/wp-json`.replace(/\/+$/, "");
        }
    } catch {/* noop */ }

    // 5) Fallback
    return `${window.location.origin}/wp-json`;
}

/**
 * Récupération des détails de commande via l’endpoint custom:
 *   GET /wp-json/wc/v3/merci/{orderId}?key=wc_order_xxx
 * Renvoie OrderDetails avec totaux déjà formatés via fmtMGA.
 */
export async function fetchOrder(orderId: number, orderKey?: string): Promise<OrderDetails> {
    const REST = getRestBase(); // .../wp-json
    const url = new URL(`${REST}/wc/v3/merci/${orderId}`);
    if (orderKey) url.searchParams.append("key", orderKey);

    let retries = 0;
    while (retries < 2) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url.toString(), {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = (await response.json()) as OrderDetails;

            // Post-process: tout en MGA lisible et normalisé
            data.items?.forEach((item) => {
                item.total = fmtMGA(item.total);
                item.price = fmtMGA(item.price);
            });
            data.total = fmtMGA(data.total);
            data.shipping_lines?.forEach((line) => {
                line.total = fmtMGA(line.total);
            });

            return data;
        }

        const status = response.status;
        let msg = `Échec de récupération de la commande: ${status} ${response.statusText}`;
        if (status === 404) msg = "Commande introuvable (404). Vérifiez l'ID.";
        else if (status === 403) msg = "Accès refusé (403). Clé de commande invalide.";
        else {
            try {
                const err = await response.json();
                if (err?.message) msg = err.message;
            } catch {/* ignore */ }
        }

        if (retries === 0 && (status === 404 || status === 403)) {
            retries++;
            await new Promise((r) => setTimeout(r, 1000));
            continue;
        }
        throw new Error(msg);
    }

    throw new Error("Échec après retry. Rechargez la page ou contactez le support.");
}