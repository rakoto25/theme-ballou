// assets/src/lib/logo.ts

// Fallback sûr (PNG 1x1 transparent) pour éviter toute 404
export const FALLBACK_LOGO_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAkoB1gCwY2wAAAAASUVORK5CYII=";

function absolutize(url: string, base: string): string {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
    if (url.startsWith("//")) return `${window.location.protocol}${url}`;
    if (url.startsWith("/")) return new URL(url, base).toString();
    return new URL(`/${url}`, base).toString();
}

async function fetchJSON(url: string): Promise<any | null> {
    try {
        const res = await fetch(url, {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            cache: "no-cache",
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Essaie d’abord /site-info/v1/site-logo (champ `logo_url`),
 * puis retombe sur /site-info/v1/logo (HTML <img> ou URL brute).
 * Ne jette jamais : retourne une data:URL fallback si besoin.
 */
export async function getSiteLogo(): Promise<string> {
    const base = window.location.origin;

    // 1) Nouveau endpoint
    const v1 = await fetchJSON(`${base}/wp-json/site-info/v1/site-logo`);
    if (v1 && typeof v1.logo_url === "string" && v1.logo_url.trim()) {
        return absolutize(v1.logo_url, base);
    }

    // 2) Ancien endpoint (HTML <img> ou URL)
    const legacy = await fetchJSON(`${base}/wp-json/site-info/v1/logo`);
    if (legacy) {
        let raw: string = legacy.logo ?? legacy.url ?? "";
        if (typeof raw === "string" && raw.trim()) {
            if (raw.includes("<img")) {
                const m = raw.match(/src="([^"]+)"/i);
                if (m?.[1]) return absolutize(m[1], base);
            } else {
                return absolutize(raw, base);
            }
        }
    }

    // 3) Fallback garanti
    return FALLBACK_LOGO_DATA_URL;
}