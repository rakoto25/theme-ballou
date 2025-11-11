// assets/src/Components/Produits/ProductCard.tsx
import React, { useMemo, useState } from "react";
import { fmtAr } from "../../lib/produits";
import { addToCart, getCartUrl, emitCartUpdated } from "../../lib/cart";

export type ProductCardData = {
    id: number;
    title: string;
    img: string;
    category: string;
    ref: string;
    price: number;
    currency: string;   // "MGA", "EUR", etc.
    permalink: string;
};

export default function ProductCard({ p }: { p: ProductCardData }) {
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);

    // Lib interne pour MGA ; sinon on formate basique + devise
    const priceLabel = useMemo(() => {
        if (p.currency === "MGA") return fmtAr(p.price);
        const txt = new Intl.NumberFormat("fr-MG", { maximumFractionDigits: 0 }).format(
            Number.isFinite(p.price) ? p.price : 0
        );
        return `${txt} ${p.currency}`;
    }, [p.price, p.currency]);

    const imgSrc =
        (p.img && String(p.img)) ||
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='100%' height='100%' fill='#f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#94a3b8' font-family='sans-serif' font-size='16'>Image indisponible</text></svg>`
        );

    async function handleAdd(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        e.stopPropagation();
        if (adding) return;

        try {
            setAdding(true);
            await addToCart(p.id, 1); // doit être "same-origin" + nonce dans lib/cart
            emitCartUpdated();
            setAdded(true);
        } catch (err) {
            console.error(err);
            alert("Impossible d’ajouter ce produit au panier.");
        } finally {
            setAdding(false);
        }
    }

    return (
        <article className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ borderColor: "var(--brand-dark, #29235c)" }}>
            {/* Image / lien produit */}
            <a href={p.permalink} className="block" aria-label={p.title}>
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <img
                        src={imgSrc}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                    {!!p.category && (
                        <span
                            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{ background: "rgba(0,0,0,.7)", color: "var(--brand-light, #ffffff)" }}
                        >
                            {p.category}
                        </span>
                    )}
                </div>
            </a>

            {/* Corps */}
            <div className="p-3">
                <h3 className="line-clamp-2 text-sm font-semibold"
                    style={{ color: "var(--brand-dark, #29235c)" }}>
                    <a href={p.permalink} className="hover:underline">
                        {p.title}
                    </a>
                </h3>

                {p.ref && (
                    <div className="mt-0.5 text-xs"
                        style={{ color: "color-mix(in oklab, var(--brand-dark, #29235c), white 60%)" }}>
                        Ref. {p.ref}
                    </div>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-base font-bold"
                        style={{ color: "var(--brand-dark, #29235c)" }}>
                        {priceLabel}
                    </span>

                    {added ? (
                        <a
                            href={getCartUrl()}
                            className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:opacity-95"
                            style={{
                                borderColor: "var(--brand-primary, #e94e1b)",
                                background: "var(--brand-accent, var(--brand-primary, #e94e1b))",
                                color: "var(--brand-light, #ffffff)",
                            }}
                            title="Voir le panier"
                            aria-label="Voir le panier"
                            onClick={(e) => e.stopPropagation()}
                        >
                            Voir
                        </a>
                    ) : (
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={adding}
                            className="rounded-full border px-3 py-1.5 text-xs font-semibold active:scale-95 disabled:opacity-60"
                            style={{
                                borderColor: "var(--brand-primary, #e94e1b)",
                                color: "var(--brand-primary, #e94e1b)",
                            }}
                            title="Ajouter au panier"
                            aria-label="Ajouter au panier"
                        >
                            {adding ? "Ajout..." : "Ajouter"}
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}