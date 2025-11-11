// assets/src/Components/Homepages/BestCategory.tsx
import * as React from "react";
import { fetchBestCategories } from "../../lib/site-info"; // ⬅️ Corrigé : import depuis site-info.ts


const BRAND_BLUE = "#29235c";


type Cat = {
    id: number;
    name: string;
    slug: string;
    count: number;
    permalink: string;
};


export default function BestCategory({
    title = "Catégories phares",
    subtitle = "Découvrez nos rayons les plus recherchés",
    limit = 10,
    orderby = "name",
    order = "ASC",
}: {
    title?: string;
    subtitle?: string;
    limit?: number;        // min 10 recommandé
    orderby?: "name" | "count" | "slug";
    order?: "ASC" | "DESC";
}) {
    const [items, setItems] = React.useState<Cat[]>([]);
    const [loading, setLoading] = React.useState(true);


    React.useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                const rows = await fetchBestCategories({ limit, orderby, order });
                if (alive) setItems(rows);
            } catch (e) {
                console.error(e);
                if (alive) setItems([]);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [limit, orderby, order]);


    return (
        <section className="relative mx-auto max-w-7xl px-4 py-10">
            <header className="mb-4">
                {subtitle && (
                    <p className="text-xs uppercase tracking-widest text-zinc-500">
                        {subtitle}
                    </p>
                )}
                <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-3xl">
                    {title}
                </h2>
            </header>


            {/* Skeleton */}
            {loading ? (
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <span
                            key={i}
                            className="h-8 w-28 animate-pulse rounded-full bg-zinc-200"
                        />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-600">
                    Aucune catégorie disponible pour le moment.
                </div>
            ) : (
                <nav className="flex flex-wrap items-center gap-2">
                    {items.map((c) => (
                        <a
                            key={c.id || c.slug}
                            href={c.permalink || `/produits?category=${encodeURIComponent(c.slug)}`}
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm transition hover:brightness-110"
                            style={{ backgroundColor: BRAND_BLUE, color: "rgba(255,255,255,.92)" }}
                            title={`${c.name}${c.count ? ` (${c.count})` : ""}`}
                        >
                            {c.name}
                            {typeof c.count === "number" && (
                                <span className="ml-1 inline-flex min-w-5 justify-center rounded-full bg-white/15 px-1 text-[11px] font-medium leading-[1.1] text-white">
                                    {c.count}
                                </span>
                            )}
                        </a>
                    ))}
                </nav>
            )}
        </section>
    );
}
