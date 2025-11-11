// assets/src/Components/Produits/Pagination.tsx
import React from "react";

export interface PaginationProps {
    currentPage: number;
    perPage: number;
    total: number;
    onPageChange: (page: number) => void;
    brandPrimary?: string;
}

export default function Pagination({
    currentPage, perPage, total, onPageChange, brandPrimary = "#e94e1b",
}: PaginationProps) {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (totalPages <= 1) return null;

    const styleVar = { ["--brand-primary" as any]: brandPrimary } as React.CSSProperties;
    const pages: (number | "…")[] = [];
    const windowSize = 2;

    pages.push(1);
    const start = Math.max(2, currentPage - windowSize);
    const end = Math.min(totalPages - 1, currentPage + windowSize);
    if (start > 2) pages.push("…");
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push("…");
    if (totalPages > 1) pages.push(totalPages);

    return (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination" style={styleVar}>
            <button
                type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 hover:bg-zinc-100"
            >
                ← Précédent
            </button>

            <ul className="flex items-center gap-1">
                {pages.map((p, i) =>
                    p === "…" ? (
                        <li key={`e-${i}`} className="px-2 text-sm text-zinc-500">…</li>
                    ) : (
                        <li key={p}>
                            <button
                                type="button" onClick={() => onPageChange(p)}
                                aria-current={p === currentPage ? "page" : undefined}
                                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${p === currentPage ? "bg-[var(--brand-primary)] text-white"
                                    : "text-zinc-700 hover:bg-zinc-100"
                                    }`}
                            >
                                {p}
                            </button>
                        </li>
                    )
                )}
            </ul>

            <button
                type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 hover:bg-zinc-100"
            >
                Suivant →
            </button>
        </nav>
    );
}