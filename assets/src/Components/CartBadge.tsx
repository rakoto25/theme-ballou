// assets/src/Components/CartBadge.tsx
import React, { useEffect, useState } from "react";
import { CART_UPDATED_EVENT, getCartCount, getCartUrl } from "../lib/cart";

type Props = {
    className?: string;
    brandPrimary?: string; // optionnel
};

export default function CartBadge({
    className = "",
    brandPrimary = "#e94e1b", // orange Ballou par défaut
}: Props) {
    const [count, setCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    async function refresh() {
        try {
            const c = await getCartCount();
            setCount(c);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();

        const onUpdated = () => refresh();
        document.addEventListener(CART_UPDATED_EVENT, onUpdated);

        const onStorage = (e: StorageEvent) => {
            if (e.key === "ballou_cart_broadcast") refresh();
        };
        window.addEventListener("storage", onStorage);

        return () => {
            document.removeEventListener(CART_UPDATED_EVENT, onUpdated);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

    const label = loading ? "Panier (chargement…)" : `Panier (${count})`;

    return (
        <a
            href={getCartUrl()}
            aria-label={label}
            title={label}
            className={`relative inline-flex flex-col items-center justify-center gap-1 ${className}`}
        >
            {/* 🛒 Icône panier */}
            <div className="relative">
                {/* 🔸 Badge en exposant (au-dessus à droite) */}
                {!loading && count > 0 && (
                    <span
                        className="
                            absolute -top-2 -right-2
                            flex items-center justify-center
                            text-white text-[10px] font-bold
                            w-[18px] h-[18px]
                            rounded-full shadow-md
                            ring-2 ring-white
                        "
                        style={{ backgroundColor: brandPrimary }}
                    >
                        {count}
                    </span>
                )}
            </div>
        </a>
    );
}