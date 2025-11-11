// assets/src/islands/CartClient.tsx - Header offset + Tailwind confirm-banner (React 19)
import React, { useEffect, useRef, useState, useTransition, useMemo } from "react";
import { getCheckoutUrl } from "../lib/cart";
import {
    getCartLines,  // Backup
    getCartItems,
    updateCartLine,
    removeCartLine,
    fetchCartQuote,
    type CartLine,
    type CartQuoteItem as FullCartItem,
    type CartQuoteResponse,
    type CartAddress,
    CART_UPDATED_EVENT,
    emitCartUpdated,
    getCookieId,
} from "../lib/cart";
import { fmtMGA as fmtMGAUtil, unfmtMGA, dlog } from "../lib/utils";

const BRAND = { blue: "#29235c", orange: "#e94e1a" };
const PLACEHOLDER_IMG = "https://via.placeholder.com/80x80/eee?text=Produit";

type CartItem = FullCartItem;

/* -------------------------------------------------------------------------- */
/*  Petite bannière de confirmation façon "Bootstrap alert" (Tailwind)        */
/* -------------------------------------------------------------------------- */
type ConfirmBannerProps = {
    visible: boolean;
    title?: string;
    message?: string;
    onConfirm: () => void;
    onCancel: () => void;
};
function ConfirmBanner({
    visible,
    title = "Confirmer la suppression",
    message = "Voulez-vous vraiment supprimer cet article du panier ?",
    onConfirm,
    onCancel,
}: ConfirmBannerProps) {
    if (!visible) return null;
    return (
        <div className="sticky top-[50px] z-50">
            <div className="mx-auto max-w-5xl px-4">
                <div className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 shadow">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-red-500" aria-hidden />
                        <div>
                            <div className="font-semibold text-red-800">{title}</div>
                            <div className="text-sm text-red-700">{message}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onCancel}
                            className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={onConfirm}
                            className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none"
                        >
                            Supprimer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CartClient({ initialAddress }: { initialAddress?: Partial<CartAddress> } = {}) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [quote, setQuote] = useState<CartQuoteResponse | null>(null);
    const [fullMatch, setFullMatch] = useState(true); // Flag pour trust quote.totals
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [address, setAddress] = useState<CartAddress>({
        country: "MG",
        postcode: "101",
        city: "Antananarivo",
        address_1: "",
        ...initialAddress,
    });
    const [chosenShip, setChosenShip] = useState<string | undefined>(undefined);
    const [couponInput, setCouponInput] = useState("");

    // Confirmation suppression (remplace confirm())
    const [pendingDelete, setPendingDelete] = useState<CartItem | null>(null);

    // Refs
    const itemsRef = useRef<CartItem[]>([]);
    const prevItemsCountRef = useRef(0);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const addressRef = useRef(address);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);
    useEffect(() => {
        addressRef.current = address;
    }, [address]);

    // Cleanup
    useEffect(() => {
        if (isUpdating && !updateTimeoutRef.current) {
            updateTimeoutRef.current = setTimeout(() => {
                setIsUpdating(false);
                updateTimeoutRef.current = null;
            }, 1000);
        }
        return () => {
            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        };
    }, [isUpdating]);

    const isBusy = isPending || isUpdating;

    // fmtMGA (util de secours si pas import global)
    const fmtMGA = useMemo(
        () => (n: number) => {
            if (!Number.isFinite(n) || n < 0) return "0 Ar";
            try {
                return new Intl.NumberFormat("fr-MG", {
                    style: "currency",
                    currency: "MGA",
                    maximumFractionDigits: 0,
                    minimumFractionDigits: 0,
                }).format(n);
            } catch {
                return `${Math.round(n).toLocaleString("fr-FR")} Ar`;
            }
        },
        []
    );

    // URL checkout dynamique (basée sur WP_API_ROOT)
    const toCheckout = useMemo(() => getCheckoutUrl(), []);

    // getUnitPriceTTC — le backend fournit déjà unitaire **TTC**
    const getUnitPriceTTC = useMemo(
        () => (item: CartItem) => {
            let unit = Number(item.unit_price || 0); // TTC direct
            // Fallback si 0 : parser product.price (peut être string "50 000 Ar" ou number)
            if (unit <= 0 && item.product?.price != null) {
                const p = item.product.price as any;
                unit = typeof p === "number" ? p : Number(String(p).replace(/[^\d]/g, "")) || 0;
            }
            if (unit <= 0) {
                dlog(
                    `[Cart Debug] Unit TTC 0 for key ${getCookieId(item)} (unit_price=${item.unit_price}, product_price=${item.product?.price})`
                );
            }
            return Math.max(unit, 0);
        },
        []
    );

    const getLineTotalTTC = useMemo(
        () => (item: CartItem) => {
            let line = Number(item.line_total || 0); // TTC ligne si dispo
            if (line <= 0) line = getUnitPriceTTC(item) * Math.max(item.qty || 1, 1);
            return Math.max(line, 0);
        },
        [getUnitPriceTTC]
    );

    // Totaux
    const { currentSubtotal, currentTotal, hasValidPrices, totalItems } = useMemo(() => {
        const totalItems = items.reduce((sum, i) => sum + (i.qty || 0), 0);
        const lineTotals = items.map((i) => ({ key: getCookieId(i), line: getLineTotalTTC(i) }));
        let subtotal = items.reduce((sum, i) => sum + getLineTotalTTC(i), 0);
        dlog("[Cart Debug] Sum TTC from items:", { subtotal, itemsCount: items.length, lineTotals });

        const isQuoteTrustworthy =
            fullMatch &&
            !!quote &&
            quote.items.length === items.length &&
            (quote.totals.subtotal || 0) > 0 &&
            Number.isFinite(quote.totals.subtotal as number);

        if (isQuoteTrustworthy) {
            subtotal = quote!.totals.subtotal!;
            dlog("[Cart Debug] Using quote.subtotal (trustworthy):", subtotal);
        } else if ((quote?.totals.subtotal || 0) > 0) {
            dlog("[Cart Debug] Ignore quote.subtotal (not trustworthy):", {
                fullMatch,
                lengths: `${quote?.items.length || 0}/${items.length}`,
            });
        }

        let total = subtotal;
        if (quote) {
            const shipping = quote.totals.shipping_total || 0;
            const tax = quote.totals.tax_total || 0;
            const discount = -(quote.totals.discount || 0);
            total += shipping + tax + discount;
            dlog("[Cart Debug] Addons from quote:", { shipping, tax, discount, total });
        }

        const hasValidPrices = total > 0 && Number.isFinite(total);
        if (!hasValidPrices) dlog("[Cart Debug] Invalid prices - sum 0, check items/products");

        dlog("[Cart Debug] Final TTC:", {
            subtotal,
            total,
            itemsCount: totalItems,
            fullMatch,
            trustworthy: isQuoteTrustworthy,
            valid: hasValidPrices,
        });
        return { currentSubtotal: subtotal, currentTotal: total, hasValidPrices, totalItems };
    }, [items, quote, fullMatch, getLineTotalTTC]);

    // Auto-retry si !hasValidPrices
    useEffect(() => {
        if (!isPending && items.length > 0 && !hasValidPrices) {
            const timer = setTimeout(() => loadAll(), 1000);
            return () => clearTimeout(timer);
        }
    }, [hasValidPrices, items.length, isPending]);

    // LoadAll
    async function loadAll() {
        if (isUpdating) return;
        setError(null);
        setIsUpdating(false);
        const expectedCount = items.length;

        dlog(`[Cart Debug] Starting loadAll... (expected items: ${expectedCount})`);

        try {
            const cartItems = await getCartItems();
            const stringKeys = cartItems.map((i) => ({ ...i, key: getCookieId(i) }));
            setItems(stringKeys);
            dlog(
                `[Cart Debug] Loaded fresh items (count: ${cartItems.length}): keys sample ${JSON.stringify(
                    stringKeys.slice(0, 3).map((i) => i.key)
                )}`
            );

            cartItems.forEach((item, idx) => {
                if ((item.unit_price || 0) <= 0 && (!item.product?.price || item.product.price === "")) {
                    dlog(
                        `[Cart Debug] Item ${idx} low price: key=${getCookieId(item)}, unit=${item.unit_price}, product_price=${item.product?.price}`
                    );
                }
            });

            if (cartItems.length === 0) {
                setItems([]);
                setQuote({
                    items: [],
                    currency: "MGA",
                    totals: {
                        subtotal_ex_tax: 0,
                        subtotal: 0,
                        discount_ex_tax: 0,
                        discount: 0,
                        items_tax: 0,
                        shipping_total: 0,
                        shipping_tax: 0,
                        tax_total: 0,
                        total: 0,
                        currency: "MGA",
                    },
                    applied_coupons: [],
                    shipping_methods: [],
                    chosen_shipping_method: null,
                });
                setFullMatch(true);
                setChosenShip(undefined);
                return;
            }

            const linesForQuote: CartLine[] = cartItems.map((i) => ({
                id: getCookieId(i),
                qty: i.qty || 1,
            }));
            const q = await fetchCartQuote({
                lines: linesForQuote,
                coupons: [],
                address: addressRef.current,
                shipping_method: chosenShip,
            });

            const unmatched = cartItems.filter(
                (i) => !q.items.some((qi) => getCookieId(qi) === getCookieId(i))
            );
            const matchLengths = q.items.length === cartItems.length;
            const isFullMatch = unmatched.length === 0 && matchLengths;
            setFullMatch(isFullMatch);
            if (!isFullMatch)
                dlog(
                    `[Cart Debug] Partial match: { unmatched: ${unmatched.length}, lengths: ${q.items.length}/${cartItems.length} }`
                );
            else dlog("[Cart Debug] Full match!");

            setQuote(q);
            setChosenShip(q.chosen_shipping_method ?? undefined);

            if (Math.abs(cartItems.length - expectedCount) > 1) {
                dlog(
                    `[Cart Debug] Count mismatch post-load: { expected: ${expectedCount}, actual: ${cartItems.length} }`
                );
                setError("Sync partiel - recharge page si ghosts.");
            }
        } catch (e: any) {
            dlog(`[Cart Debug] loadAll error: ${e.message}`);
            const freshCartItems = await getCartItems().catch(() => [] as CartItem[]);
            const freshSubtotal = freshCartItems.reduce((sum, i) => sum + getLineTotalTTC(i), 0);
            const fallbackQuote: CartQuoteResponse = {
                items: freshCartItems,
                currency: "MGA",
                totals: {
                    subtotal_ex_tax: 0,
                    subtotal: freshSubtotal,
                    discount_ex_tax: 0,
                    discount: 0,
                    items_tax: 0,
                    shipping_total: 0,
                    shipping_tax: 0,
                    tax_total: 0,
                    total: freshSubtotal,
                    currency: "MGA",
                },
                applied_coupons: [],
                shipping_methods: [],
                chosen_shipping_method: null,
            };
            setItems(freshCartItems);
            setQuote(fallbackQuote);
            setFullMatch(false);
            setError("Panier partiel (prix sum JS) - vérifiez Woo cart.");
        }
    }

    useEffect(() => {
        loadAll();

        const onUpdated = () => {
            dlog("[Cart Debug] CART_UPDATED_EVENT");
            setTimeout(loadAll, 350);
        };
        document.addEventListener(CART_UPDATED_EVENT, onUpdated);
        const onStorage = (e: StorageEvent) => {
            if (e.key === "ballou_cart_broadcast") setTimeout(loadAll, 350);
        };
        window.addEventListener("storage", onStorage);

        return () => {
            document.removeEventListener(CART_UPDATED_EVENT, onUpdated);
            window.removeEventListener("storage", onStorage);
            if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        };
    }, [address, chosenShip]);

    // Change qty
    const changeQty = (item: CartItem, nextQty: number) => {
        if (!item || isBusy) {
            dlog("[Cart Debug] changeQty blocked");
            return;
        }
        const key = getCookieId(item);
        const clamped = Math.max(1, nextQty);
        const maxQty = item.max_qty ?? Infinity;
        if (clamped > maxQty) {
            alert(`Quantité max: ${maxQty}`); // (Optionnel) Peut être migré vers une bannière aussi
            return;
        }

        dlog(`[Cart Debug] changeQty: { key: ${key}, from: ${item.qty}, to: ${clamped} }`);

        // Optimistic
        const prevItems = [...itemsRef.current];
        setItems((prev) => prev.map((i) => (getCookieId(i) === key ? { ...i, qty: clamped } : i)));
        setIsUpdating(true);
        prevItemsCountRef.current = items.length;

        startTransition(async () => {
            try {
                await updateCartLine(key, clamped, false);
                await loadAll();
                emitCartUpdated();
            } catch (e) {
                dlog(`changeQty failed: ${e}`);
                setItems(prevItems);
                setTimeout(loadAll, 500);
            } finally {
                setIsUpdating(false);
            }
        });
    };

    // Demande de suppression (ouvre la bannière)
    const requestRemove = (item: CartItem) => {
        if (!item || isBusy) return;
        setPendingDelete(item);
    };

    // Suppression réelle (déclenchée par la bannière)
    const removeLineAction = (item: CartItem) => {
        if (!item || isBusy) return;
        const key = getCookieId(item);
        const prevItems = [...itemsRef.current];
        const expectedAfter = prevItems.length - 1;

        setItems((prev) => prev.filter((i) => getCookieId(i) !== key));
        setIsUpdating(true);
        prevItemsCountRef.current = prevItems.length;

        startTransition(async () => {
            try {
                await removeCartLine(key, false);
                await new Promise((r) => setTimeout(r, 500));
                await loadAll();
                if (items.length !== expectedAfter) {
                    dlog(
                        `[Cart Debug] Ghost after remove: { expected: ${expectedAfter}, actual: ${items.length} }`
                    );
                    setError("Produit supprimé mais sync partiel - rechargez.");
                }
                emitCartUpdated();
            } catch (e) {
                dlog(`remove failed: ${e}`);
                setItems(prevItems);
                setTimeout(loadAll, 500);
            } finally {
                setIsUpdating(false);
            }
        });
    };

    // Post-render verify
    useEffect(() => {
        const actualCount = items.length;
        const expected = prevItemsCountRef.current;
        if (Math.abs(actualCount - expected) > 1 && !isPending) {
            dlog(
                `[Cart Debug] Post-render mismatch: { expected: ${expected}, actual: ${actualCount} }`
            );
            setError("Vérification sync échouée - rechargez page.");
        }
    }, [items.length]);

    // Skeleton (avec marge top)
    if (isPending) {
        return (
            <div className="mt-[50px] grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-8 w-full animate-pulse">
                <section className="bg-white rounded-2xl shadow-sm border border-slate-100">
                    <div className="px-6 py-5 bg-gray-200 h-8 rounded"></div>
                    <div className="p-6 space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-4 py-3 border-t bg-gray-50 rounded"
                            >
                                <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-8 h-8 bg-gray-200 rounded"></div>
                                    <input className="w-12 h-8 bg-gray-200 rounded" />
                                    <div className="w-8 h-8 bg-gray-200 rounded"></div>
                                </div>
                                <div className="w-20 h-4 bg-gray-200 rounded ml-4"></div>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-fit">
                    <div className="h-6 bg-gray-200 rounded mb-4 w-1/2"></div>
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex justify-between h-3 bg-gray-200 rounded w-full"></div>
                        ))}
                        <div className="h-6 bg-gray-200 rounded border-t pt-2 mt-4"></div>
                    </div>
                    <div className="h-10 bg-gray-200 rounded mt-4"></div>
                </section>
            </div>
        );
    }

    return (
        <>
            {/* Bannière de confirmation suppression */}
            <ConfirmBanner
                visible={!!pendingDelete}
                onCancel={() => setPendingDelete(null)}
                onConfirm={() => {
                    const item = pendingDelete;
                    setPendingDelete(null);
                    if (item) removeLineAction(item);
                }}
                title="Supprimer cet article ?"
                message="Cette action retirera l’article de votre panier. Vous pourrez toujours le rajouter plus tard."
            />

            <div className="mt-[50px] grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-8 w-full">
                {/* Section Produits */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full">
                    <header className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                        <h1 className="text-xl font-semibold" style={{ color: BRAND.blue }}>
                            Votre panier
                        </h1>
                        <span className="text-sm text-slate-500">
                            {totalItems} article{totalItems !== 1 ? "s" : ""}
                        </span>
                    </header>

                    {error && (
                        <div className="p-4 bg-yellow-100 text-yellow-700 rounded-b-lg">{error}</div>
                    )}

                    {items.length === 0 ? (
                        <div className="p-6 text-slate-600 text-center">
                            Votre panier est vide.{" "}
                            <a href="/categorie-produit/art-de-la-table/" className="text-[#e94e1a] underline">
                                Continuer vos achats
                            </a>
                            .
                        </div>
                    ) : (
                        <div className="p-6 text-slate-600 max-h-[70vh] overflow-y-auto">
                            <div className="mb-2 text-xs text-gray-500">
                                Produits: {items.length} | Match quote: {fullMatch ? "Oui" : "Partiel"} | Keys
                                uniques:{" "}
                                {new Set(items.map(getCookieId)).size === items.length ? "Oui" : "Duplicates!"}
                            </div>
                            <div className="space-y-4">
                                {items.map((item) => {
                                    const key = getCookieId(item);
                                    const unitPriceTTC = getUnitPriceTTC(item);
                                    const lineTotalTTC = getLineTotalTTC(item);
                                    const maxQty = item.max_qty ?? Infinity;
                                    const canIncrease = !isBusy && (item.qty || 0) < maxQty;
                                    const hasValidPrice = unitPriceTTC > 0;

                                    return (
                                        <div
                                            key={key}
                                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 py-3 gap-3"
                                        >
                                            <div className="flex items-start">
                                                <img
                                                    src={item.product?.images?.[0]?.src || PLACEHOLDER_IMG}
                                                    alt={item.product?.name || "Produit"}
                                                    className="h-16 w-16 object-cover rounded-lg flex-shrink-0"
                                                    onError={(e) => {
                                                        e.currentTarget.src = PLACEHOLDER_IMG;
                                                    }}
                                                />
                                                <div className="ml-4 min-w-0 flex-1">
                                                    <a
                                                        href={item.product?.permalink || "#"}
                                                        className="text-base sm:text-lg font-semibold line-clamp-2 block"
                                                        style={{ color: BRAND.blue }}
                                                    >
                                                        {item.product?.name || `Produit ID: ${item.id}`}
                                                    </a>
                                                    <div className="sm:hidden mt-1">
                                                        <button
                                                            onClick={() => requestRemove(item)}
                                                            className="text-red-600 underline underline-offset-2 text-sm"
                                                            disabled={isBusy}
                                                        >
                                                            Retirer
                                                        </button>
                                                    </div>
                                                    <div className="text-sm text-slate-600 mt-1">
                                                        Unité: {hasValidPrice ? fmtMGA(unitPriceTTC) : "Prix indisponible"}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0">
                                                <div className="text-right min-w-[120px]">
                                                    <span className="font-semibold text-base block">
                                                        {hasValidPrice ? fmtMGA(lineTotalTTC) : "Indisponible"}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => changeQty(item, (item.qty || 0) - 1)}
                                                        className={`px-3 py-1 bg-gray-200 rounded-lg flex-shrink-0 ${isBusy || (item.qty || 0) <= 1
                                                            ? "opacity-50 cursor-not-allowed"
                                                            : "hover:bg-gray-300"
                                                            }`}
                                                        disabled={isBusy || (item.qty || 0) <= 1}
                                                    >
                                                        −
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={item.qty || 1}
                                                        onChange={(e) => changeQty(item, Number(e.target.value) || 1)}
                                                        min={1}
                                                        max={maxQty}
                                                        className={`w-12 text-center py-1 border rounded-lg ${isBusy ? "bg-gray-100 cursor-not-allowed" : "hover:border-gray-400"
                                                            }`}
                                                        disabled={isBusy}
                                                    />
                                                    <button
                                                        onClick={() => changeQty(item, (item.qty || 0) + 1)}
                                                        className={`px-3 py-1 bg-gray-200 rounded-lg flex-shrink-0 ${!canIncrease ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-300"
                                                            }`}
                                                        disabled={!canIncrease}
                                                        title={!canIncrease ? `Max: ${maxQty}` : "Ajouter"}
                                                    >
                                                        +
                                                    </button>

                                                    <button
                                                        onClick={() => requestRemove(item)}
                                                        className="hidden sm:inline-flex px-3 py-1 bg-red-500 text-white rounded-lg disabled:opacity-50 text-sm font-medium flex-shrink-0 hover:bg-red-600"
                                                        disabled={isBusy}
                                                    >
                                                        Retirer
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {!hasValidPrices && items.length > 0 && (
                                <button
                                    onClick={loadAll}
                                    className="block w-full text-center text-blue-500 underline mt-4"
                                >
                                    Recharger prix
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {/* Résumé */}
                {items.length > 0 && (
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-4 h-fit">
                        <h2 className="text-xl font-semibold mb-4" style={{ color: BRAND.blue }}>
                            Résumé
                        </h2>
                        {isUpdating && (
                            <div className="mb-2 text-sm text-orange-600">Mise à jour en cours...</div>
                        )}
                        {!fullMatch && <div className="mb-2 text-sm text-yellow-600"></div>}
                        {!hasValidPrices && (
                            <div className="mb-2 text-sm text-yellow-600">
                                Prix non chargés - vérifiez console/Woo.
                            </div>
                        )}
                        <div className="space-y-2 text-sm mb-4">
                            <div className="flex justify-between">
                                <span>Sous-total</span>
                                <span>{hasValidPrices ? fmtMGA(currentSubtotal) : "Indisponible"}</span>
                            </div>
                            {quote && fullMatch && (quote.totals.tax_total ?? 0) > 0 && (
                                <div className="flex justify-between">
                                    <span>Taxes</span>
                                    <span>{fmtMGA(quote.totals.tax_total)}</span>
                                </div>
                            )}
                            {quote && fullMatch && (quote.totals.shipping_total ?? 0) > 0 && (
                                <div className="flex justify-between">
                                    <span>Livraison</span>
                                    <span>{fmtMGA(quote.totals.shipping_total)}</span>
                                </div>
                            )}
                            {quote && fullMatch && (quote.totals.discount ?? 0) > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Remise</span>
                                    <span>-{fmtMGA(quote.totals.discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-4">
                                <span>Total TTC</span>
                                <span className={hasValidPrices ? "" : "text-red-500"}>
                                    {hasValidPrices ? fmtMGA(currentTotal) : "Indisponible"}
                                </span>
                            </div>
                        </div>

                        <a
                            href={isBusy || !hasValidPrices ? undefined : toCheckout}
                            onClick={(e) => {
                                if (isBusy || !hasValidPrices) {
                                    e.preventDefault(); // évite navigation “fantôme” quand désactivé
                                }
                            }}
                            className={`w-full block px-4 py-3 text-center rounded-lg font-semibold transition-colors ${isBusy || !hasValidPrices
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-[#e94e1a] text-white hover:bg-[#d14416]"
                                }`}
                            role="button"
                            aria-disabled={isBusy || !hasValidPrices}
                        >
                            {isBusy
                                ? "Chargement..."
                                : `Commander (${hasValidPrices ? fmtMGA(currentTotal) : "0 Ar"})`}
                        </a>
                    </section>
                )}
            </div>
        </>
    );
}