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
    currency: string;
    permalink: string;
};

export default function ProductCard({ p }: { p: ProductCardData }) {
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);

    /* ------------------------------------------------------------ */
    /* PRICE */
    /* ------------------------------------------------------------ */
    const priceLabel = useMemo(() => {
        if (p.currency === "MGA") return fmtAr(p.price);
        const txt = new Intl.NumberFormat("fr-MG", { maximumFractionDigits: 0 })
            .format(Number.isFinite(p.price) ? p.price : 0);
        return `${txt} ${p.currency}`;
    }, [p.price, p.currency]);

    /* ------------------------------------------------------------ */
    /* IMAGE FALLBACK */
    /* ------------------------------------------------------------ */
    const imgSrc =
        p.img ||
        "data:image/svg+xml;utf8," +
        encodeURIComponent(`
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>
            <rect width='100%' height='100%' fill='#f5f5f4'/>
            <text x='50%' y='50%' dominant-baseline='middle' 
                text-anchor='middle' fill='#aaa' 
                font-family='sans-serif' font-size='16'>
                Image indisponible
            </text>
        </svg>`);

    /* ------------------------------------------------------------ */
    /* ADD TO CART */
    /* ------------------------------------------------------------ */
    async function handleAdd(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        e.stopPropagation();
        if (adding) return;

        try {
            setAdding(true);
            await addToCart(p.id, 1);
            emitCartUpdated();
            setAdded(true);
        } catch {
            alert("Impossible d’ajouter ce produit au panier.");
        } finally {
            setAdding(false);
        }
    }

    /* ------------------------------------------------------------ */
    /* LUXURY SHOP CARD */
    /* ------------------------------------------------------------ */
    return (
        <article
            className="
                product-card
                group relative overflow-hidden rounded-[22px]
                bg-white
                border border-[#f4f4f4]                              // Gris très clair
                shadow-[0_2px_8px_rgba(220,220,220,0.2)]             // Ombre blanc cassé douce
                transition-all duration-500
                hover:shadow-[0_10px_32px_0_rgba(200,200,200,0.28)]  // Ombre plus grande, blanc cassé
                hover:-translate-y-[4px]
            ">


            {/* --------------------------- IMAGE --------------------------- */}
            <a href={p.permalink} className="block" aria-label={p.title}>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-[22px]">
                    <img
                        src={imgSrc}
                        alt={p.title}
                        loading="lazy"
                        className="
                            h-full w-full object-cover
                            transition-all duration-700 
                            group-hover:scale-[1.08]
                            group-hover:brightness-[1.05]
                        "
                    />

                    {p.category && (
                        <span
                            className="
                                absolute left-3 top-3
                                rounded-full px-3 py-1
                                text-[11px] font-medium
                                bg-white/70 backdrop-blur 
                                border border-[#e7e5e4]
                                text-[#3f3f46]
                                shadow-sm
                            "
                        >
                            {p.category}
                        </span>
                    )}
                </div>
            </a>

            {/* --------------------------- INFO --------------------------- */}
            <div className="p-4">
                <h3 className="line-clamp-2 text-[15px] font-semibold text-[#2e2e2e] leading-snug">
                    <a href={p.permalink} className="hover:opacity-80 transition">
                        {p.title}
                    </a>
                </h3>

                {p.ref && (
                    <div className="mt-1 text-xs text-[#a3a3a3]">
                        Ref. {p.ref}
                    </div>
                )}

                {/* ------------------------ PRICE + BUTTON ------------------------ */}
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-semibold text-[#1c1c1c] tracking-tight">
                        {priceLabel}
                    </span>

                    {added ? (
                        <a
                            href={getCartUrl()}
                            onClick={(e) => e.stopPropagation()}
                            className="
                                rounded-full px-4 py-1.5 text-xs font-medium
                                bg-black text-white transition
                                hover:bg-neutral-800 shadow-sm
                            "
                        >
                            Voir
                        </a>
                    ) : (
                        <button
                            disabled={adding}
                            onClick={handleAdd}
                            className="
                                rounded-full px-4 py-1.5 text-xs font-medium
                                border border-[#d6d3d1] text-[#444]
                                hover:border-[#bfbcb9]
                                hover:bg-[#f8f7f5]
                                transition-all active:scale-95 
                                disabled:opacity-60
                            "
                        >
                            {adding ? "Ajout…" : "Ajouter"}
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}