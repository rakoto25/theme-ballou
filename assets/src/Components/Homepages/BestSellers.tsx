// assets/src/Components/Homepages/Bestsellers.tsx
import * as React from "react";
import {
    fetchBestSellersLite,
    useSharedCart,
    useCartButton,
} from "../../lib/bestseller"; // Assurez "bestseller.ts" (sans 's')
import type { CartLine } from "../../lib/cart";

type Product = {
    id: number;
    title: string;
    price: number;
    currency: string;
    img: string;
    href: string;
    sku?: string;
};

const fmt = (v: number, cur = "MGA") => {
    const c = (cur || "MGA").toUpperCase();
    if (c === "MGA") return `${Math.round(v).toLocaleString("fr-FR")} Ar`;
    try {
        return new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: c,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(v);
    } catch {
        return `${Math.round(v).toLocaleString("fr-FR")} ${c}`;
    }
};

function BestCard({ p, lines, refresh }: { p: Product; lines?: CartLine[]; refresh: () => Promise<void> }) { // lines? pour safe
    console.log("[Bestsellers BestCard] Props for", p.id, ": lines type=", typeof lines, "length=", lines?.length || "undefined"); // Debug

    const { inCart, add, cartUrl } = useCartButton(p.id, lines, refresh); // Passe lines (guardé dans hook)
    const [adding, setAdding] = React.useState(false);

    const onAdd = async () => {
        console.log('Attempting to add product ID:', p.id, 'Title:', p.title);
        try {
            setAdding(true);
            await add(1);
            console.log('Add successful for product ID:', p.id);
        } catch (e) {
            console.error('Add failed for product ID:', p.id, e);
            alert("Impossible d'ajouter ce produit au panier.");
        } finally {
            setAdding(false);
        }
    };

    return (
        <article className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-[2px] hover:shadow-md">
            <a href={p.href} className="block" aria-label={p.title}>
                <img
                    src={p.img}
                    alt={p.title}
                    loading="lazy"
                    className="h-56 w-full object-cover transition group-hover:scale-[1.02]"
                />
            </a>
            <div className="p-3">
                <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900">
                    <a href={p.href} className="hover:underline">{p.title}</a>
                </h3>
                {p.sku && (
                    <div className="mt-1 text-xs text-zinc-500">
                        Réf : <span className="font-medium">{p.sku}</span>
                    </div>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-zinc-900">
                        {fmt(p.price, p.currency)}
                    </span>
                    {inCart ? (
                        <a
                            href={cartUrl}
                            className="rounded-full border border-[#29235c] bg-[#29235c] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                            title="Voir le panier"
                        >
                            Voir le panier
                        </a>
                    ) : (
                        <button
                            type="button"
                            onClick={onAdd}
                            disabled={adding}
                            className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
                            title="Ajouter au panier"
                        >
                            {adding ? "Ajout…" : "Ajouter"}
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}

export default function Bestsellers({
    title = "Nos meilleures ventes",
    subtitle = "Pièces plébiscitées par nos clients",
    limit = 12,
    days = 30,
    category,
    includeVariations = false,
}: {
    title?: string;
    subtitle?: string;
    limit?: number;
    days?: number;
    category?: string;
    includeVariations?: boolean;
}) {
    const [items, setItems] = React.useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = React.useState(true);

    const { lines, refreshCart, loading: loadingCart } = useSharedCart(); // Destructuring safe (lines = [])

    React.useEffect(() => {
        let ok = true;
        (async () => {
            try {
                setLoadingProducts(true);
                const rows = await fetchBestSellersLite({
                    limit, days, category, include_variations: includeVariations
                });
                const mapped: Product[] = rows.map((r: any) => ({
                    id: Number(r.id),
                    title: r.title || r.name || r.slug || "Produit sans nom",
                    price: Number(r.price) || 0,
                    currency: (r.currency || "MGA").toUpperCase(),
                    img: r.image || "/wp-content/uploads/placeholder.png",
                    href: r.permalink || `/produit/${encodeURIComponent(r.slug || "")}/`,
                    sku: r.sku || undefined,
                }));
                if (ok) {
                    setItems(mapped);
                    console.log("[Bestsellers] Produits chargés:", mapped.length, "| Cart lines initial:", lines.length);
                }
            } catch (e) {
                console.error("[Bestsellers Error]", e);
                if (ok) setItems([]);
            } finally {
                if (ok) setLoadingProducts(false);
            }
        })();
        return () => { ok = false; };
    }, [limit, days, category, includeVariations]); // Retiré lines.length (cycle inutile)

    const trackRef = React.useRef<HTMLDivElement | null>(null);
    const cardRef = React.useRef<HTMLDivElement | null>(null);
    const [perView, setPerView] = React.useState(5);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        const calc = () => {
            if (matchMedia("(max-width: 640px)").matches) return 1;
            if (matchMedia("(max-width: 768px)").matches) return 2;
            if (matchMedia("(max-width: 1024px)").matches) return 3;
            return 5;
        };
        setPerView(calc());
        const onResize = () => setPerView(calc());
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const scrollByCards = (dir: 1 | -1) => {
        const track = trackRef.current;
        const card = cardRef.current;
        if (!track || !card) return;
        const gap = 16;
        const delta = (card.offsetWidth + gap) * perView * dir;
        track.scrollBy({ left: delta, behavior: "smooth" });
    };

    const canSlide = items.length > 1;
    const isLoading = loadingProducts || loadingCart;

    return (
        <section className="relative mx-auto max-w-7xl px-4 py-10">
            <header className="mb-6 flex items-end justify-between gap-4">
                <div>
                    {subtitle && (
                        <p className="text-xs uppercase tracking-widest text-zinc-500">
                            {subtitle}
                        </p>
                    )}
                    <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
                        {title}
                    </h2>
                </div>

                <div className={`hidden items-center gap-3 sm:flex ${canSlide ? "" : "opacity-30"}`}>
                    <button
                        aria-label="Précédent"
                        disabled={!canSlide}
                        onClick={() => canSlide && scrollByCards(-1)}
                        className="h-10 w-10 rounded-full border border-zinc-200 bg-white text-zinc-700 shadow hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <button
                        aria-label="Suivant"
                        disabled={!canSlide}
                        onClick={() => canSlide && scrollByCards(1)}
                        className="h-10 w-10 rounded-full border border-zinc-200 bg-white text-zinc-700 shadow hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </header>

            {isLoading ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-zinc-200 p-4">
                            <div className="aspect-[4/5] w-full animate-pulse bg-zinc-100" />
                            <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
                            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
                        </div>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-600">
                    Aucune meilleure vente pour le moment.
                </div>
            ) : (
                <>
                    <div className="relative">
                        <div
                            ref={trackRef}
                            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] snap-hide"
                            style={{ scrollBehavior: "smooth" }}
                        >
                            {items.map((p, idx) => (
                                <div
                                    key={p.id}
                                    ref={idx === 0 ? cardRef : undefined}
                                    className="snap-start shrink-0 basis-[80%] sm:basis-[45%] md:basis-[30%] lg:basis-[19%]"
                                >
                                    <BestCard p={p} lines={lines} refresh={refreshCart} />
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex items-center justify-center gap-3 sm:hidden">
                            <button
                                disabled={!canSlide}
                                onClick={() => canSlide && scrollByCards(-1)}
                                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Précédent
                            </button>
                            <button
                                disabled={!canSlide}
                                onClick={() => canSlide && scrollByCards(1)}
                                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Suivant
                            </button>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}