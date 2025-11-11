import React, { useEffect, useState } from "react";

type Item = { id: number; title: string; url: string; type: string };

export default function SearchBox() {
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Item[]>([]);

    useEffect(() => {
        const ctrl = new AbortController();
        const nonce = (window as any).__BALLOU__?.nonce;
        const ajaxUrl = (window as any).__BALLOU__?.ajaxUrl || "/wp-admin/admin-ajax.php";
        const run = async () => {
            if (!q.trim()) { setItems([]); return; }
            const u = new URL(ajaxUrl, window.location.href);
            u.searchParams.set("action", "ballou_search_suggest");
            u.searchParams.set("q", q);
            u.searchParams.set("nonce", nonce);
            const res = await fetch(u.toString(), { signal: ctrl.signal });
            const json = await res.json();
            if (json?.success) setItems(json.data.items || []);
        };
        const t = setTimeout(run, 180);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [q]);

    return (
        <div className="relative w-full max-w-md">
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 focus:outline-none focus:ring"
                placeholder="Rechercher un produit…"
                aria-label="Recherche"
            />
            {open && items.length > 0 && (
                <div className="absolute z-10 mt-2 w-full rounded-xl border bg-white shadow">
                    {items.map((it) => (
                        <a key={it.id} href={it.url} className="block px-4 py-2 hover:bg-gray-50">
                            <span className="text-sm font-medium">{it.title}</span>
                            <span className="ml-2 text-xs text-gray-500">{it.type}</span>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
