// islands/checkout.tsx – Version "sans livraison" + Paiement complet
import React, { useEffect, useState, useRef, useMemo } from "react";
import {
    loadCartLines,
    fetchOptions,
    createOrder,
    type CheckoutLine,
    type Address,
    type CheckoutOptions,
} from "../lib/checkout";
import {
    fetchCartQuoteSmart,
    CART_UPDATED_EVENT,
    type CartQuoteResponse,
    type CartAddress,
} from "../lib/cart";

/** Helper : parse product_id depuis une key '613_0' → 613 */
function parseProductIdFromKey(id: string): number {
    if (typeof id === "string" && id.includes("_")) {
        const parts = id.split("_");
        return Number(parts[0]) || 0;
    }
    return Number(id) || 0;
}

type Props = {
    initialAddress: Address & {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
    };
    initialLines?: CheckoutLine[]; // From PHP cookies
};

type Billing = Address & {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
};

export default function CheckoutIsland({ initialAddress, initialLines }: Props) {
    const [lines, setLines] = useState<CheckoutLine[]>(initialLines || []);
    const [billing, setBilling] = useState<Billing>({
        ...initialAddress,
        first_name: initialAddress.first_name || "",
        last_name: initialAddress.last_name || "",
        email: initialAddress.email || "",
        phone: initialAddress.phone || "",
        country: initialAddress.country || "MG",
        postcode: initialAddress.postcode || "101",
        city: initialAddress.city || "Antananarivo",
        address_1: initialAddress.address_1 || "",
    });
    const [note, setNote] = useState<string>("");

    const [options, setOptions] = useState<CheckoutOptions | null>(null);
    const [quote, setQuote] = useState<CartQuoteResponse | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<string>("");
    const [couponInput, setCouponInput] = useState("");
    const [coupons, setCoupons] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(!initialLines);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [promoError, setPromoError] = useState<string | null>(null);

    const prevBillingRef = useRef<Billing | null>(null);
    const retryCountRef = useRef<number>(0);
    const maxRetries = 3;

    const fmtMGA = (n: number) => {
        const v = Math.round(Number.isFinite(n) ? n : 0);
        try {
            return new Intl.NumberFormat("fr-MG", {
                style: "currency",
                currency: "MGA",
                maximumFractionDigits: 0,
                minimumFractionDigits: 0,
            }).format(v);
        } catch {
            return `${v.toLocaleString("fr-FR")} Ar`;
        }
    };

    // -------- Totaux : lines (qty ajoutée × unit TTC) prioritaire
    const getCurrentSubtotal = () => {
        const hasQtyMismatch = quote?.items?.some((item) => {
            const pid = parseProductIdFromKey(item.id || "");
            const line = lines.find(
                (l) => (l.product_id ?? parseProductIdFromKey(l.id || "")) === pid
            );
            return line && item.qty !== line.qty;
        });
        if (quote?.totals?.subtotal != null && quote.items.length > 0 && !hasQtyMismatch) {
            return Number(quote.totals.subtotal);
        }
        let sum = 0;
        lines.forEach((l) => {
            const pid = l.product_id ?? parseProductIdFromKey(l.id || "");
            const matchingItem = quote?.items?.find(
                (i) => Number(i.product_id || i.id) === pid
            );
            const unitTTC = matchingItem?.unit_price || l.unit_price || 0;
            const qtyAdded = l.qty;
            sum += unitTTC * qtyAdded;
        });
        return sum;
    };

    const getCurrentTotal = () => {
        const hasQtyMismatch = quote?.items?.some((item) => {
            const pid = parseProductIdFromKey(item.id || "");
            const line = lines.find(
                (l) => (l.product_id ?? parseProductIdFromKey(l.id || "")) === pid
            );
            return line && item.qty !== line.qty;
        });
        if (quote?.totals?.total != null && quote.items.length > 0 && !hasQtyMismatch) {
            return Number(quote.totals.total);
        }
        const subtotal = getCurrentSubtotal();
        const discount = Math.max(0, Number(quote?.totals?.discount || 0));
        const shippingTotal = Number(quote?.totals?.shipping_total || 0);
        const total = subtotal - discount + shippingTotal;
        return total;
    };

    const currentSubtotal = useMemo(() => getCurrentSubtotal(), [quote, lines]);
    const currentTotal = useMemo(() => getCurrentTotal(), [quote, lines]);

    // -------- Adresse pour quote : **toujours** facturation (on retire toute logique livraison)
    const getQuoteAddress = (): CartAddress => ({
        country: billing.country,
        postcode: billing.postcode || "",
        city: billing.city || "",
        address_1: billing.address_1 || "",
    });

    const fetchFreshData = async (retry = false) => {
        if (retry) {
            retryCountRef.current += 1;
            if (retryCountRef.current > maxRetries) {
                setError("Panier non synchronisé. Rechargez ou contactez support.");
                setLoading(false);
                return;
            }
            await new Promise((r) =>
                setTimeout(r, Math.pow(2, retryCountRef.current - 1) * 500)
            );
        }

        try {
            setError(null);
            setPromoError(null);

            let freshLines: CheckoutLine[];
            if (initialLines && initialLines.length > 0 && !retry) {
                freshLines = initialLines;
                localStorage.setItem("ballou_cart", JSON.stringify(freshLines));
            } else {
                freshLines = await loadCartLines(retryCountRef.current);
            }

            if (freshLines.length === 0 && !retry) {
                setTimeout(() => fetchFreshData(true), 500);
                return;
            }
            setLines(freshLines);

            if (freshLines.length === 0) {
                const emptyQuote: CartQuoteResponse = {
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
                    shipping_methods: [], // ignoré dans l’UI
                    chosen_shipping_method: null,
                };
                setQuote(emptyQuote);
                setOptions(null);
                setLoading(false);
                return;
            }

            const cartBilling: CartAddress = getQuoteAddress();
            const quoteLines = freshLines.map((l) => ({
                id: l.id,
                qty: l.qty,
                product_id: l.product_id,
            }));

            // ⛔️ On ne transmet **aucune** méthode de livraison ici.
            let q = await fetchCartQuoteSmart({
                lines: quoteLines as any,
                address: cartBilling,
                coupons,
            });

            // Nettoyage “ghosts” + recalculs sûrs
            const normPid = (v: any) => String(Number(v || 0));
            const allowedPids = new Set(
                freshLines.map((l) =>
                    normPid(l.product_id ?? parseProductIdFromKey(l.id || ""))
                )
            );

            const originalItems = Array.isArray(q?.items) ? q.items : [];
            const filteredItems = originalItems.filter((it) =>
                allowedPids.has(normPid(it.product_id || it.id))
            );

            let itemsForUi = originalItems;
            if (filteredItems.length > 0 && filteredItems.length < originalItems.length) {
                itemsForUi = filteredItems;
                let fixedSubtotal = 0;
                filteredItems.forEach((it) => {
                    const pid = Number(it.product_id || it.id);
                    const line = freshLines.find(
                        (l) =>
                            Number(l.product_id ?? parseProductIdFromKey(l.id || "")) === pid
                    );
                    const unit = it.unit_price || 0;
                    const qtyAdded = line?.qty || it.qty || 1;
                    fixedSubtotal += unit * qtyAdded;
                });
                const itemsTax = filteredItems.reduce(
                    (s, it) => s + Number(it.line_tax || 0),
                    0
                );
                const discount = Number(q?.totals?.discount || 0);
                const shippingTotal = Number(q?.totals?.shipping_total || 0);
                const shippingTax = Number(q?.totals?.shipping_tax || 0);
                const fixedTotals = {
                    subtotal_ex_tax: Number(q?.totals?.subtotal_ex_tax || 0),
                    subtotal: fixedSubtotal,
                    discount_ex_tax: Number(q?.totals?.discount_ex_tax || 0),
                    discount,
                    items_tax: itemsTax,
                    shipping_total: shippingTotal,
                    shipping_tax: shippingTax,
                    tax_total: itemsTax + shippingTax,
                    total: fixedSubtotal + shippingTotal - Math.max(0, Math.abs(discount)),
                    currency: q?.totals?.currency || q?.currency || "MGA",
                };
                q = { ...q, items: itemsForUi, totals: fixedTotals };
            } else {
                q = { ...q, items: itemsForUi };
            }

            setQuote(q);

            const opts = await fetchOptions(billing as any, freshLines as any);
            setOptions(opts);

            // Paiement : on pré-sélectionne la 1ère méthode disponible (si aucune sélection)
            if (!selectedPayment && opts?.payments?.length) {
                const firstEnabled = opts.payments.find((p) => p.enabled)?.id;
                setSelectedPayment(firstEnabled || opts.payments[0].id);
            }
        } catch (e: any) {
            setError(e?.message || "Échec chargement (vérifiez API).");
            setLines([]);
            setQuote(null);
        } finally {
            setLoading(false);
        }
    };

    // Mount
    useEffect(() => {
        const timer = setTimeout(() => fetchFreshData(), 300);
        return () => clearTimeout(timer);
    }, []);

    // Re-fetch sur update du panier
    useEffect(() => {
        const handleCartUpdate = () => {
            retryCountRef.current = 0;
            fetchFreshData();
        };
        document.addEventListener(CART_UPDATED_EVENT, handleCartUpdate);
        return () => {
            document.removeEventListener(CART_UPDATED_EVENT, handleCartUpdate);
        };
    }, []);

    // Re-quote si facturation change (livraison retirée)
    useEffect(() => {
        const prevBilling = prevBillingRef.current;
        const billingChanged =
            !prevBilling ||
            prevBilling.country !== billing.country ||
            prevBilling.postcode !== billing.postcode ||
            prevBilling.city !== billing.city ||
            prevBilling.address_1 !== billing.address_1;

        prevBillingRef.current = billing;

        if (!loading && billingChanged) {
            fetchFreshData();
        }
    }, [billing, loading]);

    // Coupons
    const applyCoupon = async () => {
        if (!couponInput.trim()) return;
        const newCoupons = [...coupons, couponInput.trim()];
        setCoupons(newCoupons);
        setCouponInput("");
        setLoading(true);
        await fetchFreshData();
        setLoading(false);
    };

    const billingValid =
        (billing.first_name || "").trim().length > 0 &&
        (billing.last_name || "").trim().length > 0 &&
        /\S+@\S+\.\S+/.test(billing.email || "") &&
        (billing.phone || "").trim().length > 3 &&
        (billing.address_1 || "").trim().length > 5 &&
        (billing.city || "").trim().length > 2;

    const canSubmit =
        !submitting &&
        !!options &&
        !!selectedPayment &&
        lines.length > 0 &&
        billingValid &&
        !!quote;

    const handleSubmit = async () => {
        if (!options || !canSubmit || lines.length === 0) {
            setError("Complétez les informations et vérifiez votre panier.");
            return;
        }
        if (currentTotal <= 0) {
            setError("Total invalide (0 Ar) – rechargez le panier.");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            // Pas d’adresse de livraison : on duplique la facturation côté backend
            const shippingAddress = {
                country: billing.country,
                postcode: billing.postcode,
                city: billing.city,
                address_1: billing.address_1,
                address_2: "",
            };

            const result = await createOrder({
                lines,
                coupons,
                billing,
                shipping: shippingAddress,
                // Pas de shipping_method
                payment_method: selectedPayment,
                taxes: quote?.totals || undefined,
                note,
            });

            if (note.trim()) {
                console.log(`[Checkout Submit] Note: "${note.trim().substring(0, 50)}..."`);
            }
            window.location.href = result.payment_url;
        } catch (e: any) {
            setError(e?.message || "Échec création commande");
        } finally {
            setSubmitting(false);
        }
    };

    // Loading/Empty
    if (loading || !quote) {
        return (
            <div className="flex justify-center items-center py-8">
                <div className="text-sm text-slate-500">Chargement du panier…</div>
            </div>
        );
    }

    if (lines.length === 0) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-semibold mb-4 text-slate-600">Panier vide</h2>
                <p className="text-sm text-slate-500 mb-6">
                    Aucun produit actif. Vérifiez votre panier.
                </p>
                {retryCountRef.current >= maxRetries && (
                    <p className="text-xs text-red-600 mb-2">Sync échouée (console/Woo).</p>
                )}
                <button
                    onClick={() => {
                        retryCountRef.current = 0;
                        fetchFreshData();
                    }}
                    className="mr-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Recharger panier
                </button>
                <a
                    href="/panier"
                    className="inline-block bg-[#e94e1a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#d14416]"
                >
                    Retour au panier
                </a>
            </div>
        );
    }

    // -------- Affichage force line_total = unit × qty ajoutée
    const displayItems = lines
        .map((line) => {
            const pid = line.product_id ?? parseProductIdFromKey(line.id || "");
            const matchingItem = quote?.items?.find(
                (item) => Number(item.product_id || item.id) === pid
            );
            const unitTTC = matchingItem?.unit_price || line.unit_price || 0;
            const quoteLineTotal = matchingItem?.line_total || 0;
            const qtyAdded = line.qty;
            const lineTotalTTC = unitTTC * qtyAdded;

            const images =
                matchingItem?.product?.images ||
                line.product?.images || [{ src: "/placeholder.png", alt: line.name || "Produit" }];
            const name = matchingItem?.product?.name || line.name || `Produit ${pid}`;
            const permalink =
                matchingItem?.product?.permalink || line.product?.permalink || "#";
            const available = matchingItem?.available ?? line.available ?? true;

            return {
                ...line,
                product_id: pid,
                qty: qtyAdded,
                unit_price: unitTTC,
                line_total: lineTotalTTC,
                product: { name, images, permalink },
                available,
            };
        })
        .filter((item) => item.qty > 0);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-[50px]">
            {/* Colonne Gauche : Facturation + Note (⚠️ Livraison supprimée) */}
            <div className="space-y-6">
                <section className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold mb-4 text-[#29235c]">
                        Adresse de facturation
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Prénom *</label>
                            <input
                                type="text"
                                value={billing.first_name}
                                onChange={(e) =>
                                    setBilling((p) => ({ ...p, first_name: e.target.value }))
                                }
                                className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e94e1a]"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Nom *</label>
                            <input
                                type="text"
                                value={billing.last_name}
                                onChange={(e) =>
                                    setBilling((p) => ({ ...p, last_name: e.target.value }))
                                }
                                className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e94e1a]"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Email *</label>
                            <input
                                type="email"
                                value={billing.email}
                                onChange={(e) =>
                                    setBilling((p) => ({ ...p, email: e.target.value }))
                                }
                                className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e94e1a]"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Téléphone *</label>
                            <input
                                type="tel"
                                value={billing.phone}
                                onChange={(e) =>
                                    setBilling((p) => ({ ...p, phone: e.target.value }))
                                }
                                className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e94e1a]"
                                required
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Adresse complète *</label>
                            <input
                                type="text"
                                value={billing.address_1}
                                onChange={(e) =>
                                    setBilling((p) => ({ ...p, address_1: e.target.value }))
                                }
                                placeholder="Ex: 123 Rue Exemple, Antananarivo"
                                className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e94e1a]"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Code postal</label>
                            <input
                                type="text"
                                value={billing.postcode}
                                onChange={(e) =>
                                    setBilling((p) => ({ ...p, postcode: e.target.value }))
                                }
                                className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e94e1a]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Ville *</label>
                            <input
                                type="text"
                                value={billing.city}
                                onChange={(e) =>
                                    setBilling((p) => ({ ...p, city: e.target.value }))
                                }
                                className="mt-1 block w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e94e1a]"
                                required
                            />
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4 text-[#29235c]">
                        Note pour la commande
                    </h3>
                    <p className="text-sm text-slate-500 mb-3">
                        Optionnel : Ajoutez des instructions spéciales.
                    </p>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Entrez votre message (max 500 caractères)…"
                        rows={3}
                        maxLength={500}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e94e1a] resize-none"
                    />
                    <div className="text-xs text-slate-500 mt-1 text-right">
                        {note.length}/500
                    </div>
                </section>
            </div>

            {/* Colonne Droite : Produits + Promo + Paiement + Totaux (livraison retirée de l’UI) */}
            <div className="space-y-6">
                <section className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4 text-[#29235c]">Vos produits</h3>
                    {displayItems.length > 0 ? (
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                            {displayItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-b-0"
                                >
                                    <img
                                        src={item.product?.images?.[0]?.src || "/placeholder.png"}
                                        alt={item.product?.name || "Produit"}
                                        className="h-12 w-12 object-cover rounded"
                                        onError={(e) => {
                                            e.currentTarget.src =
                                                "https://via.placeholder.com/48?text=P";
                                        }}
                                    />
                                    <div className="flex-1">
                                        <a
                                            href={item.product?.permalink || "#"}
                                            className="font-medium text-[#29235c] hover:underline"
                                        >
                                            {item.product?.name || `Produit ${item.product_id}`}
                                        </a>
                                        <div className="text-sm text-slate-500">
                                            Qté: {item.qty} × {fmtMGA(item.unit_price)} TTC
                                            {item.available === false && (
                                                <span className="text-red-500 ml-2">
                                                    (Stock insuffisant)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold">{fmtMGA(item.line_total)}</div>
                                    </div>
                                </div>
                            ))}
                            {displayItems.length < lines.length && (
                                <p className="text-xs text-yellow-600 mt-2">
                                    Synchronisation partielle – prix approximatifs.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="text-sm text-yellow-600">
                            Produits non chargés (mismatch API). Cliquez “Recharger panier”.
                        </div>
                    )}
                </section>

                <section className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4 text-[#29235c]">Code promo</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value)}
                            placeholder="Entrez votre code promo"
                            className={`flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${promoError
                                ? "border-red-300 focus:ring-red-500"
                                : "border-slate-300 focus:ring-[#e94e1a]"
                                }`}
                        />
                        <button
                            onClick={applyCoupon}
                            disabled={!couponInput.trim() || loading}
                            className="px-4 py-2 bg-[#e94e1a] text-white rounded-lg disabled:opacity-50 font-medium hover:bg-[#d14416]"
                        >
                            Appliquer
                        </button>
                    </div>
                    {promoError && <p className="text-sm text-red-600 mt-2">{promoError}</p>}
                    {coupons.length > 0 && (
                        <div className="mt-3 p-2 bg-green-50 rounded text-sm text-green-700">
                            Codes : {coupons.join(", ")}
                            {quote?.totals.discount && quote.totals.discount < 0 && (
                                <span> (- {fmtMGA(Math.abs(quote.totals.discount))})</span>
                            )}
                        </div>
                    )}
                </section>

                {/* 🚚 Bloc Livraison SUPPRIMÉ (méthodes et adresse) */}

                {/* 💳 Paiement – affiche TOUS les moyens configurés (enabled ou non) */}
                {options?.payments?.length > 0 && (
                    <section className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="text-lg font-semibold mb-4 text-[#29235c]">
                            Méthode de paiement
                        </h3>

                        <div className="space-y-2">
                            {options.payments.map((payment) => {
                                const disabled = payment.enabled === false;
                                return (
                                    <label
                                        key={payment.id}
                                        className={`flex items-center justify-between py-2 px-3 rounded-lg border ${disabled
                                            ? "border-slate-200 opacity-60 cursor-not-allowed"
                                            : "border-slate-200 hover:border-slate-300 cursor-pointer"
                                            }`}
                                        title={
                                            disabled
                                                ? "Méthode configurée mais actuellement indisponible"
                                                : payment.description || ""
                                        }
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="payment"
                                                value={payment.id}
                                                checked={selectedPayment === payment.id}
                                                onChange={() => !disabled && setSelectedPayment(payment.id)}
                                                className="mr-1"
                                                disabled={disabled}
                                            />
                                            <span className="font-medium">{payment.title}</span>
                                        </div>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded ${disabled
                                                ? "bg-slate-100 text-slate-500"
                                                : "bg-emerald-50 text-emerald-700"
                                                }`}
                                        >
                                            {disabled ? "Indisponible" : "Disponible"}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </section>
                )}

                <section className="bg-white rounded-xl shadow-sm p-6">
                    {loading && (
                        <div className="mb-2 text-sm text-orange-600">
                            Mise à jour… (total approx.)
                        </div>
                    )}
                    <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                            <span>Sous-total TTC</span>
                            <span className="font-semibold">{fmtMGA(currentSubtotal)}</span>
                        </div>

                        {(quote?.totals.tax_total ?? 0) > 0 && (
                            <div className="flex justify-between text-slate-500">
                                <span>Taxes</span>
                                <span>{fmtMGA(quote.totals.tax_total)}</span>
                            </div>
                        )}

                        {/* On garde l’affichage si le backend inclut un coût de livraison */}
                        {(quote?.totals.shipping_total ?? 0) > 0 && (
                            <div className="flex justify-between text-slate-500">
                                <span>Livraison</span>
                                <span>{fmtMGA(quote.totals.shipping_total)}</span>
                            </div>
                        )}

                        {(quote?.totals.discount ?? 0) < 0 && (
                            <div className="flex justify-between text-green-600">
                                <span>Remise</span>
                                <span>{fmtMGA(quote.totals.discount)}</span>
                            </div>
                        )}

                        <div className="flex justify-between font-bold text-lg border-t pt-2 text-[#29235c]">
                            <span>Total TTC</span>
                            <span>{fmtMGA(currentTotal)}</span>
                        </div>
                    </div>

                    {(!billingValid || !selectedPayment || lines.length === 0 || currentTotal <= 0) && (
                        <p className="text-xs text-slate-500 mb-3">
                            Complétez la facturation, choisissez un mode de paiement et vérifiez le panier.
                        </p>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full bg-[#e94e1a] text-white py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed font-semibold hover:bg-[#d14416] transition-colors"
                    >
                        {submitting ? "Création…" : `Valider et payer ${fmtMGA(currentTotal)}`}
                    </button>

                    {error && (
                        <div className="text-red-600 text-sm mt-3 p-2 bg-red-50 rounded">
                            {error}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
