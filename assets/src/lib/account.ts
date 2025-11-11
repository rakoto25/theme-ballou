// assets/src/lib/account.ts
// API client pour les endpoints personnalisés "Ballou Account API"

export interface Address {
    first_name?: string;
    last_name?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    phone?: string;
    email?: string;
}

export interface User {
    id: number;
    display_name: string;
    email: string;
    first_name: string;
    last_name: string;
}

export interface AccountData {
    user: User;
    billing: Address;
    shipping: Address;
}

export interface Order {
    id: number;
    date: string;
    status: string;
    total: string;
    view_url: string;
}

export interface OrdersResponse {
    items: Order[];
    hasMore: boolean;
    page: number;
    totalPages: number;
}

export interface UpdatePayload {
    first_name: string;
    last_name: string;
    email: string;
    billing?: Address;
    shipping?: Address;
    new_password?: string;
}

/* ───────────────────────────────────────────────
 * Helpers
 * ─────────────────────────────────────────────── */

function getBaseUrl(): string {
    const home = (window as any)?.wcApiData?.home_url || window.location.origin;
    return home.replace(/\/+$/, "");
}

function getNonce(): string | null {
    return (window as any)?.wcApiData?.nonce || null;
}

/** Construit l'URL REST complète */
function buildUrl(path: string): string {
    return `${getBaseUrl()}/wp-json/${path.replace(/^\/+/, "")}`;
}

/** Gestion standard de fetch JSON */
async function safeFetch<T>(
    input: RequestInfo,
    init: RequestInit = {}
): Promise<T> {
    const opts: RequestInit = {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init.headers || {}),
            "X-WP-Nonce": getNonce() || "",
            Accept: "application/json",
        },
    };

    const res = await fetch(input, opts);
    const text = await res.text();

    if (!res.ok) {
        let msg = text;
        try {
            const json = JSON.parse(text);
            msg = json.message || JSON.stringify(json);
        } catch { }
        console.error(`[BallouAccountAPI] ${res.status} ${input.toString()} → ${msg}`);
        throw new Error(msg || `Erreur HTTP ${res.status}`);
    }

    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error("Réponse JSON invalide du serveur.");
    }
}

/* ───────────────────────────────────────────────
 * Endpoints
 * ─────────────────────────────────────────────── */

/**
 * 🔹 Récupère les infos du compte connecté
 * GET /wp-json/ballou/v1/account/me
 */
export async function getMe(): Promise<AccountData> {
    return safeFetch<AccountData>(buildUrl("ballou/v1/account/me"));
}

/**
 * 🔹 Liste les commandes du compte connecté
 * GET /wp-json/ballou/v1/account/orders?page=1&per_page=10
 */
export async function listOrders(
    page = 1,
    perPage = 10
): Promise<OrdersResponse> {
    const url = buildUrl(
        `ballou/v1/account/orders?page=${page}&per_page=${perPage}`
    );
    return safeFetch<OrdersResponse>(url);
}

/**
 * 🔹 Met à jour le profil utilisateur (nom, email, adresses, mot de passe)
 * POST /wp-json/ballou/v1/account/me
 */
export async function updateMe(
    payload: UpdatePayload
): Promise<{ success: boolean; message: string }> {
    const url = buildUrl("ballou/v1/account/me");
    return safeFetch<{ success: boolean; message: string }>(url, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/* ───────────────────────────────────────────────
 * Hooks React (facultatif mais pratique)
 * ─────────────────────────────────────────────── */

import { useEffect, useState } from "react";

/** Hook simple pour charger le compte courant */
export function useAccount() {
    const [data, setData] = useState<AccountData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        getMe()
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    return { data, loading, error };
}

/** Hook simple pour charger les commandes */
export function useOrders(page = 1, perPage = 10) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);

    useEffect(() => {
        setLoading(true);
        listOrders(page, perPage)
            .then((res) => {
                setOrders(res.items);
                setHasMore(res.hasMore);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [page, perPage]);

    return { orders, hasMore, loading, error };
}