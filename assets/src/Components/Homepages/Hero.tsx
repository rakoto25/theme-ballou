// src/Components/Homepages/hero.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useBallouSlider } from "../../lib/ballouslider";

type Cat = { label: string; slug: string };

type Props = {
    categories?: Cat[];
    ctaNewUrl?: string;
    ctaCatsUrl?: string;
    prefixCatUrl?: string;
    sliderId?: number;
    apiBaseUrl?: string;
    imageSize?: "full" | "large" | "thumb";
    intervalMs?: number;
};

const BRAND = {
    blue: "#29235c",
    orange: "#e94e1b",
    dark: "#1b1919",
};

export default function Hero({
    categories = [],
    ctaNewUrl = "/nouveautes",
    ctaCatsUrl = "/categories",
    prefixCatUrl = "/c",
    sliderId,
    apiBaseUrl,
    imageSize = "large",
    intervalMs = 6000,
}: Props) {
    const { urls, loading, error } = useBallouSlider(sliderId ?? 0, {
        size: imageSize,
        baseUrl: apiBaseUrl,
    });

    const [idx, setIdx] = useState(0);
    const timerRef = useRef<number | null>(null);

    const images = useMemo(() => (Array.isArray(urls) ? urls : []), [urls]);
    const hasImages = images.length > 0;

    useEffect(() => {
        if (error) console.error("[Hero] Slider error:", error);
        if (urls) console.log("[Hero] URLs slider:", urls);
    }, [urls, error]);

    useEffect(() => {
        if (!hasImages) return;

        setIdx((i) => (i >= images.length ? 0 : i));

        const run = () => {
            if (images.length <= 1) return;
            timerRef.current = window.setInterval(() => {
                setIdx((prev) => (prev + 1) % images.length);
            }, Math.max(1000, intervalMs));
        };

        run();

        const onVisibility = () => {
            if (document.hidden) {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
            } else if (!timerRef.current) {
                run();
            }
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [hasImages, images, intervalMs]);

    const bgA = hasImages ? images[idx % images.length] : undefined;
    const bgB = hasImages ? images[(idx + 1) % images.length] : undefined;

    return (
        <section
            className="relative overflow-hidden mt-10" // 🟢 marge top pour compenser le header fixé
            style={{
                backgroundColor: BRAND.blue,
                minHeight: "70vh",
                backgroundImage: bgA ? `url("${bgA}")` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
            }}
            aria-label="Mise en avant d'accueil"
        >
            {/* BACKGROUND SLIDER */}
            {hasImages && (
                <div aria-hidden className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
                    <div
                        key={bgA}
                        className="absolute inset-0 transition-opacity duration-700 ease-in-out will-change-[opacity,background-image] motion-reduce:transition-none"
                        style={{
                            backgroundImage: bgA ? `url("${bgA}")` : undefined,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                            opacity: 1,
                        }}
                    />
                    {images.length > 1 && (
                        <div
                            key={bgB}
                            className="absolute inset-0 transition-opacity duration-700 ease-in-out will-change-[opacity,background-image] motion-reduce:transition-none"
                            style={{
                                backgroundImage: bgB ? `url("${bgB}")` : undefined,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                                opacity: 0,
                            }}
                        />
                    )}

                    {/* 🎯 Dégradé subtil */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.10) 35%, rgba(0,0,0,0.24) 100%)",
                        }}
                    />
                </div>
            )}

            {/* CONTENU centré (grid) */}
            <div className="relative grid min-h-[70vh] place-items-center">
                <div className="w-full px-4">
                    {/* Carte translucide */}
                    <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-md md:p-8">
                        {/* Badge */}
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15">
                            <span className="inline-block h-2 w-2 rounded-full bg-white/80" />
                            Spécialiste d’intérieur
                        </span>

                        {/* Titre */}
                        <h1 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">
                            Habillez votre intérieur avec sobriété et caractère.
                        </h1>

                        {/* Paragraphe */}
                        <p className="mt-4 text-white/90 md:text-lg">
                            Meubles, literie, tapis, déco et art de la table. Des pièces sélectionnées
                            pour des espaces élégants et fonctionnels.
                        </p>

                        {/* CTAs */}
                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <a
                                href={ctaNewUrl}
                                className="inline-flex items-center justify-center rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white/95 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                            >
                                Découvrir les nouveautés
                            </a>

                            <a
                                href={ctaCatsUrl}
                                className="inline-flex items-center justify-center rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                            >
                                Voir toutes les catégories
                            </a>
                        </div>

                        {/* Chips catégories */}
                        {categories.length > 0 && (
                            <nav className="mt-6 flex flex-wrap items-center gap-2">
                                {categories.map((c) => (
                                    <a
                                        key={c.slug}
                                        href={`${prefixCatUrl}/${encodeURIComponent(c.slug)}`}
                                        className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/15 transition hover:bg-white/15"
                                    >
                                        {c.label}
                                    </a>
                                ))}
                            </nav>
                        )}

                        {/* Debug */}
                        {sliderId && (
                            <div className="mt-4 text-xs text-white/70">
                                {loading && "…"}
                                {error && <span className="text-red-200">Erreur: {error}</span>}
                                {!loading && !error && images.length === 0 && "Aucune image pour ce slider."}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Pause du slider au survol */}
            <style>{`
      @media (hover:hover) {
        section:hover .will-change-[opacity,background-image] {
          transition-duration: 0s !important;
        }
      }
    `}</style>
        </section>
    );
}
