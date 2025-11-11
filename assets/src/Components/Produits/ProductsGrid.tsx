// assets/src/Components/Produits/ProductsGrid.tsx
import React, { useMemo, useState } from "react";
import { addToCart, emitCartUpdated, getCartUrl } from "../../lib/cart";

type CardInput = {
    id: number;
    title: string;
    img: string;
    category: string;
    ref: string;
    price: number;
    currency: string; // "MGA"…
    permalink: string;
};

function useBrandVars() {
    // Lis les variables CSS définies plus haut dans l'arbre (via styleVar du parent)
    // et donne des fallbacks sensés si absentes.
    const vars = useMemo(() => {
        if (typeof window === "undefined") {
            return {
                brandPrimary: "#e94e1b",
                brandDark: "#29235c",
                brandLight: "#ffffff",
                brandAccent: "#e94e1b",
            };
        }
        const root = document.documentElement;
        const get = (name: string, fallback: string) =>
            getComputedStyle(root).getPropertyValue(name).trim() || fallback;

        const brandPrimary = get("--brand-primary", "#e94e1b");
        const brandDark = get("--brand-dark", "#29235c");
        // on garde des fallback simples pour light/accent
        const brandLight = get("--brand-light", "#ffffff");
        const brandAccent = get("--brand-accent", brandPrimary);
        return { brandPrimary, brandDark, brandLight, brandAccent };
    }, []);
    return vars;
}

export default function ProductsGrid({ products }: { products: CardInput[] }) {
    const [addingId, setAddingId] = useState<number | null>(null);
    const [addedMap, setAddedMap] = useState<Record<number, boolean>>({});
    const { brandPrimary, brandDark, brandLight, brandAccent } = useBrandVars();

    if (!products.length) {
        return (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
                Aucun produit ne correspond à vos filtres.
            </div>
        );
    }

    async function handleAdd(p: CardInput, e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation(); // évite quickview / navigation sur la carte
        if (addingId === p.id) return;

        try {
            setAddingId(p.id);
            await addToCart(p.id, 1); // doit utiliser credentials:'same-origin' + nonce côté lib/cart
            emitCartUpdated();
            setAddedMap((m) => ({ ...m, [p.id]: true }));
        } catch (err) {
            console.error(err);
            alert("Impossible d’ajouter au panier.");
        } finally {
            setAddingId(null);
        }
    }

    const toCurrency = (price: number, currency: string) => {
        const n = Number.isFinite(price) ? price : 0;
        const txt = new Intl.NumberFormat("fr-MG", { maximumFractionDigits: 0 }).format(n);
        return currency === "MGA" ? `${txt} Ar` : `${txt} ${currency}`;
    };

    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
                const isAdding = addingId === p.id;
                const isAdded = !!addedMap[p.id];
                const imgSrc =
                    (p.img && String(p.img)) ||
                    "data:image/svg+xml;utf8," +
                    encodeURIComponent(
                        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='100%' height='100%' fill='#f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#94a3b8' font-family='sans-serif' font-size='16'>Image indisponible</text></svg>`
                    );

                return (
                    <article
                        key={p.id}
                        className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-[2px] hover:shadow-md"
                        style={{ borderColor: brandDark }}
                    >
                        {/* Lien vers la fiche produit */}
                        <a href={p.permalink} className="block" aria-label={p.title}>
                            <div className="relative aspect-[4/5] w-full overflow-hidden">
                                <img
                                    src={imgSrc}
                                    alt={p.title}
                                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                                    loading="lazy"
                                />
                                {p.category && (
                                    <span
                                        className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium"
                                        style={{ background: "rgba(0,0,0,.7)", color: brandLight }}
                                    >
                                        {p.category}
                                    </span>
                                )}
                            </div>
                        </a>

                        <div className="p-3">
                            <h3 className="line-clamp-2 text-sm font-semibold" style={{ color: brandDark }}>
                                <a href={p.permalink} className="hover:underline">
                                    {p.title}
                                </a>
                            </h3>

                            {p.ref && (
                                <p
                                    className="mt-0.5 text-xs"
                                    style={{ color: "color-mix(in oklab, black, white 60%)" }}
                                >
                                    Ref. {p.ref}
                                </p>
                            )}

                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-base font-bold" style={{ color: brandDark }}>
                                    {toCurrency(p.price, p.currency)}
                                </span>

                                {/* CTA: Ajouter -> Voir */}
                                {isAdded ? (
                                    <a
                                        href={getCartUrl()}
                                        onClick={(e) => e.stopPropagation()}
                                        className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:opacity-95"
                                        style={{
                                            borderColor: brandPrimary,
                                            background: brandAccent,
                                            color: brandLight,
                                        }}
                                        aria-label="Voir le panier"
                                        title="Voir le panier"
                                    >
                                        Voir
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => handleAdd(p, e)}
                                        disabled={isAdding}
                                        className="rounded-xl border px-3 py-1.5 text-xs font-semibold active:scale-95 disabled:opacity-60"
                                        style={{ borderColor: brandPrimary, color: brandPrimary }}
                                        aria-label="Ajouter au panier"
                                        title="Ajouter au panier"
                                    >
                                        {isAdding ? "Ajout..." : "Ajouter"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}