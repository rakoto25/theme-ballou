// montheme/assets/src/lib/ballouslider.ts
// Utilitaires pour consommer la REST API du plugin "Ballou Slider"

import { useEffect, useMemo, useRef, useState } from "react";

export type BallouSliderImage = {
    id: number;
    full: string;
    large: string;
    thumb: string;
};

export type BallouSliderPayload = {
    id: number;
    title: string;
    images: BallouSliderImage[];
    count: number;
};

export type FetchOptions = {
    baseUrl?: string; // ex: "https://monsite.com" (par défaut: auto)
    size?: "full" | "large" | "thumb";
    signal?: AbortSignal;
};

/* ==============================
   🔧 Gestion dynamique des domaines
============================== */
function getDefaultBaseUrl(): string {
    if (typeof window === "undefined") return "http://localhost";

    const host = window.location.hostname;

    if (host.includes("dev.balloupro.mg")) return "https://dev.balloupro.mg";
    if (host.includes("ballou.mg")) return "https://ballou.mg";
    if (host.includes("localhost") || host.includes("127.0.0.1"))
        return "http://localhost/ballou"; // ajuste si ton WP local est dans un sous-dossier

    return window.location.origin;
}

/** Construit l’URL complète */
function buildApiUrl(path: string, baseUrl?: string): string {
    const root = baseUrl || getDefaultBaseUrl();
    return `${root.replace(/\/+$/, "")}/wp-json/${path.replace(/^\/+/, "")}`;
}

/** Normalise une URL relative → absolue */
export function normalizeToAbsolute(url: string): string {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const origin = typeof window !== "undefined" ? getDefaultBaseUrl() : "";
    if (url.startsWith("/")) return origin + url;
    return origin + "/" + url.replace(/^\.?\//, "");
}

/* ==============================
   🧠 Fonctions principales
============================== */

/** Récupère le slider par ID, sinon retente automatiquement le premier slider disponible */
export async function fetchBallouSlider(
    sliderId: number,
    opts: FetchOptions = {}
): Promise<BallouSliderPayload> {
    const base = opts.baseUrl || getDefaultBaseUrl();

    async function getSingle(id: number): Promise<BallouSliderPayload | null> {
        const url = buildApiUrl(`ballou/v1/sliders/${id}`, base);
        const res = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: opts.signal,
            credentials: "same-origin",
        });
        if (!res.ok) return null;
        try {
            return (await res.json()) as BallouSliderPayload;
        } catch {
            return null;
        }
    }

    // 🧩 Si sliderId est fourni, on tente d'abord celui-là
    if (Number.isFinite(sliderId) && sliderId > 0) {
        const found = await getSingle(sliderId);
        if (found && found.images.length > 0) return found;
    }

    // 🔁 Sinon on récupère le premier slider dispo dans la liste
    const listUrl = buildApiUrl(`ballou/v1/sliders`, base);
    const listRes = await fetch(listUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: opts.signal,
        credentials: "same-origin",
    });

    if (!listRes.ok) throw new Error(`Impossible de récupérer la liste des sliders (${listRes.status})`);

    const list = await listRes.json();
    const firstId = Array.isArray(list) && list.length > 0 ? list[0].id : null;

    if (!firstId) throw new Error("Aucun slider trouvé dans la base.");

    const first = await getSingle(firstId);
    if (!first) throw new Error("Impossible de charger le slider par défaut.");

    return first;
}

/** Retourne les URLs d’images selon la taille */
export function pickImageUrls(
    payload: BallouSliderPayload,
    size: NonNullable<FetchOptions["size"]> = "full"
): string[] {
    const key = size;
    return Array.from(
        new Set(
            payload.images
                .map((img) => (img[key] || img.full || img.thumb || "").trim())
                .filter(Boolean)
                .map(normalizeToAbsolute)
        )
    );
}

/** Précharge les images */
export function preloadImages(urls: string[]): void {
    if (typeof window === "undefined") return;
    urls.forEach((src) => {
        const img = new Image();
        img.src = src;
    });
}

/** Hook React pratique */
export function useBallouSlider(
    sliderId: number,
    options: { size?: "full" | "large" | "thumb"; baseUrl?: string } = {}
) {
    const { size = "large", baseUrl } = options;
    const [urls, setUrls] = useState<string[] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        async function run() {
            try {
                setLoading(true);
                setError(null);
                const payload = await fetchBallouSlider(sliderId, { size, baseUrl, signal: ctrl.signal });
                const u = pickImageUrls(payload, size);
                if (u.length > 0) preloadImages(u);
                setUrls(u);
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
                setUrls([]);
            } finally {
                setLoading(false);
            }
        }

        run();
        return () => ctrl.abort();
    }, [sliderId, size, baseUrl]);

    return useMemo(() => ({ urls, loading, error }), [urls, loading, error]);
}