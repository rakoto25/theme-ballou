import React, { useEffect, useState } from "react";
import { fetchOrder, type OrderDetails } from "../lib/thankyou";
import jsPDF from "jspdf";

interface ThankyouProps {
    orderId: number;
    orderKey: string;
}

/* ---------- Utils ---------- */
const fmtDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("fr-MG", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

const normalizeSpaces = (s: string) =>
    s.replace(/\u00A0|\u202F|\u2007|\u2060/g, " ");

// Fallback discret (1x1 transparent) – utilisé SEULEMENT en cas d'erreur réseau
const FALLBACK_LOGO_DATA_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAkoB1gCwY2wAAAAASUVORK5CYII=";

/**
 * Récupère la base du site WP à partir de <link rel="https://api.w.org/" href=".../wp-json/">
 * Exemple: http://localhost/ballou/wp-json/  ->  http://localhost/ballou
 */
function getWpBaseFromHead(): string | null {
    const el = document.querySelector<HTMLLinkElement>('link[rel="https://api.w.org/"]');
    if (!el?.href) return null;
    try {
        const u = new URL(el.href);
        // retire le suffixe /wp-json/ (ou /wp-json)
        const path = u.pathname.replace(/\/wp-json\/?$/, "");
        return `${u.protocol}//${u.host}${path}`;
    } catch {
        return null;
    }
}

/**
 * Construit une URL absolue fiable vers un asset de thème
 * ex: themeAsset("montheme", "assets/images/logo-ballou.jpg")
 * -> <wp-base>/wp-content/themes/montheme/assets/images/logo-ballou.jpg
 */
function themeAsset(themeFolder: string, pathFromThemeRoot: string): string {
    const wpBase = getWpBaseFromHead() || window.location.origin; // gère le cas sous-dossier
    const cleanTheme = themeFolder.replace(/^\/+|\/+$/g, "");
    const cleanPath = pathFromThemeRoot.replace(/^\/+/, "");
    return `${wpBase}/wp-content/themes/${cleanTheme}/${cleanPath}`;
}

/* ---------- Composant ---------- */
export default function Thankyou({ orderId, orderKey }: ThankyouProps) {
    const [order, setOrder] = useState<OrderDetails | null>(null);

    // 🔵 Utilise directement le logo bleu du thème (adapter "ballou-update" si besoin)
    const THEME_LOGO_URL = themeAsset("ballou-update", "assets/images/logo-ballou.jpg");

    // ✅ On met directement l'URL du logo du thème; on NE bascule au fallback que si <img> échoue
    const [logoUrl, setLogoUrl] = useState<string>(THEME_LOGO_URL);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<number>(0);

    // Charger la commande
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setError(null);
                setErrorCode(0);
                const data = await fetchOrder(orderId, orderKey);
                setOrder(data);
            } catch (e: any) {
                const msg = e?.message || "Erreur inconnue";
                setError(msg);
                if (msg.includes("404")) setErrorCode(404);
                else if (msg.includes("403")) setErrorCode(403);
                document.dispatchEvent(new CustomEvent("island-error", { detail: { island: "thankyou" } }));
            } finally {
                setLoading(false);
            }
        })();
    }, [orderId, orderKey]);

    useEffect(() => {
        if (order && !loading && !error) {
            document.dispatchEvent(new CustomEvent("island-mounted", { detail: { island: "thankyou" } }));
        }
    }, [order, loading, error]);

    const retry = () => window.location.reload();

    /* ---------- PDF (utilise le JPEG du thème si disponible) ---------- */
    const generatePDF = async () => {
        if (!order) return;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        const draw = (hasLogo = false, imgData?: string, format: "JPEG" | "PNG" = "JPEG") => {
            if (hasLogo && imgData) {
                try {
                    doc.addImage(imgData, format, pageWidth / 2 - 15, 10, 30, 30);
                } catch { }
            } else {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                doc.text("Votre commande", pageWidth / 2, 18, { align: "center" });
            }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.text("Confirmation de commande", pageWidth / 2, hasLogo ? 50 : 28, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.text(`#${order.id} - ${fmtDate(order.date_created)}`, pageWidth / 2, hasLogo ? 58 : 36, { align: "center" });

            let y = hasLogo ? 75 : 54;

            doc.setFontSize(11);
            doc.text("Informations client", 15, y);
            y += 6; doc.line(15, y, pageWidth - 15, y); y += 8;

            const addr = `${order.billing.address_1}, ${order.billing.city}, ${order.billing.country}`;
            doc.text(`${order.billing.first_name} ${order.billing.last_name}`, 15, y); y += 6;
            doc.text(order.billing.email, 15, y); y += 6;
            if (order.billing.phone) { doc.text(order.billing.phone, 15, y); y += 6; }
            doc.text(addr, 15, y); y += 12;

            doc.setFont("helvetica", "bold");
            doc.text("Détails de la commande", 15, y); y += 6;
            doc.setFont("helvetica", "normal");
            doc.line(15, y, pageWidth - 15, y); y += 10;

            doc.setFontSize(10);
            doc.text("Produit", 15, y);
            doc.text("Qté", 100, y);
            doc.text("Prix", 130, y);
            doc.text("Total", 170, y);
            y += 6; doc.line(15, y, pageWidth - 15, y); y += 8;

            order.items.forEach((item) => {
                doc.text(normalizeSpaces(item.name), 15, y);
                doc.text(String(item.quantity), 100, y);
                doc.text(normalizeSpaces(item.price), 130, y);
                doc.text(normalizeSpaces(item.total), 170, y);
                y += 8;
                if (y > 260) { doc.addPage(); y = 20; }
            });

            y += 10; doc.line(15, y, pageWidth - 15, y); y += 8;
            doc.setFont("helvetica", "bold");
            doc.text(normalizeSpaces(`Total TTC: ${order.total}`), 15, y); y += 10;
            const payTitle = order.payment_method_title || order.payment_method || "—";
            doc.setFont("helvetica", "normal");
            doc.text(`Paiement: ${payTitle}`, 15, y);

            doc.save(`commande-${order.id}.pdf`);
        };

        try {
            // Si on a le vrai logo du thème (http/https), on le convertit en dataURL pour jsPDF
            if (!logoUrl.startsWith("data:")) {
                const r = await fetch(logoUrl, { cache: "force-cache" });
                if (r.ok) {
                    const blob = await r.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => draw(true, reader.result as string, "JPEG");
                    reader.readAsDataURL(blob);
                    return;
                }
            }
            // Sinon on tente avec ce qu'on a (data:URL fallback éventuel), ou sans logo
            if (logoUrl.startsWith("data:")) {
                draw(true, logoUrl, logoUrl.includes("image/png") ? "PNG" : "JPEG");
            } else {
                draw(false);
            }
        } catch {
            draw(false);
        }
    };

    /* ---------- UI ---------- */
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <div className="animate-spin rounded-full h-7 w-7 border-4 border-[#e94e1a] border-t-transparent mb-3" />
                Chargement de votre commande…
            </div>
        );
    }

    if (error || !order) {
        const is404 = errorCode === 404;
        const is403 = errorCode === 403;
        return (
            <div className="text-center px-4 py-10">
                <h2 className="text-lg sm:text-xl font-semibold text-red-600 mb-2">Erreur de chargement</h2>
                <p className="text-gray-600 mb-3">{error || "Commande non trouvée."}</p>
                {is404 && <p className="text-sm text-gray-500 mb-2">La commande n’existe pas ou a été supprimée.</p>}
                {is403 && <p className="text-sm text-gray-500 mb-2">Lien expiré ou clé invalide. Vérifiez l’email.</p>}
                <div className="flex flex-col sm:inline-flex gap-3">
                    <button onClick={retry} className="bg-[#e94e1a] text-white px-5 py-2 rounded-lg hover:bg-[#d14416] transition">
                        Réessayer
                    </button>
                    <a href="/mon-compte" className="text-blue-600 underline">Mon compte</a>
                </div>
            </div>
        );
    }

    const isOffline = ["on-hold", "pending"].includes(order.status);
    const payTitle = order.payment_method_title || order.payment_method || "—";

    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm sm:shadow-md max-w-4xl mx-auto mt-6 sm:mt-10 px-3 sm:px-6 md:px-8 py-6 sm:py-8">
            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
                <img
                    src={logoUrl}
                    alt="Logo du site"
                    className="mx-auto h-12 sm:h-16 mb-3 sm:mb-4 opacity-90"
                    onError={(e) => {
                        // Si l’URL du thème échoue (404 sous-dossier, faute de casse…), on bascule sur un fallback discret
                        (e.currentTarget as HTMLImageElement).src = FALLBACK_LOGO_DATA_URL;
                        setLogoUrl(FALLBACK_LOGO_DATA_URL);
                    }}
                />
                <h1 style={{ color: "var(--brand-blue, #14ed8)" }} className="text-2xl sm:text-3xl font-bold text-primary-600">Merci pour votre commande !</h1>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">
                    Commande #{order.id} du {fmtDate(order.date_created)}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    Statut :{" "}
                    <span className={`font-semibold ${isOffline ? "text-orange-600" : "text-primary-600"}`}>{order.status}</span>
                </p>
            </div>

            {/* Adresse */}
            <div className="bg-gray-50 border border-gray-200 p-4 sm:p-5 rounded-lg mb-6 sm:mb-8">
                <h3 className="font-semibold mb-2 text-gray-800 text-sm sm:text-base">Facturation & Retrait local</h3>
                <div className="text-sm sm:text-base text-gray-700 space-y-1 break-words">
                    <p className="font-medium">{order.billing.first_name} {order.billing.last_name}</p>
                    <p className="text-gray-600">{order.billing.email}{order.billing.phone ? ` · ${order.billing.phone}` : ""}</p>
                    <p className="text-gray-600">{order.billing.address_1}, {order.billing.city}, {order.billing.country}</p>
                </div>
            </div>

            {/* Produits — mobile cards */}
            <div className="md:hidden mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Vos produits</h3>
                <ul className="space-y-3">
                    {order.items.map((item, i) => (
                        <li key={`${item.name}-${i}`} className="border border-gray-200 rounded-lg p-3 bg-white">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-medium text-gray-900 line-clamp-2 break-words">{item.name}</div>
                                    <div className="text-xs text-gray-500 mt-1">Qté : <span className="font-medium">{item.quantity}</span></div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xs text-gray-500">{item.price} <span className="opacity-70">/u</span></div>
                                    <div className="text-sm font-semibold text-gray-900">{item.total}</div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Produits — desktop table */}
            <div className="hidden md:block overflow-x-auto mb-8">
                <div className="min-w-[640px] overflow-hidden border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-[#e94e1a] text-white">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium">Produit</th>
                                <th className="px-4 py-3 text-right text-sm font-medium">Qté</th>
                                <th className="px-4 py-3 text-right text-sm font-medium">Prix unitaire</th>
                                <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {order.items.map((item, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition">
                                    <td className="px-4 py-3 text-gray-800"><span className="line-clamp-2 break-words">{item.name}</span></td>
                                    <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{item.price}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{item.total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Totaux */}
            <div className="mb-6 sm:mb-8">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 w-full sm:w-3/4 md:w-1/2 ml-auto">
                    <div className="flex items-center justify-between text-gray-600 text-sm sm:text-base">
                        <span>Livraison</span>
                        <span>0 Ar</span>
                    </div>
                    <div className="border-t my-3" />
                    <div className="flex items-center justify-between text-lg sm:text-xl font-bold text-gray-900">
                        <span>Total TTC</span>
                        <span>{order.total}</span>
                    </div>
                </div>
            </div>

            {/* Paiement + actions */}
            <div className="text-center">
                <p className="text-gray-700 text-sm sm:text-base mb-3">Paiement : <strong>{payTitle}</strong></p>
                {isOffline && (
                    <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-lg p-3 sm:p-4 mb-5 text-sm sm:text-base">
                        Votre commande est en attente (virement/retrait). Les instructions ont été envoyées par email.
                    </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-center">
                    <a href="/mon-compte/" className="w-full sm:w-auto text-center bg-[#e94e1a] text-white px-5 py-3 rounded-xl font-medium hover:bg-[#d14416] transition">
                        Suivre mes commandes
                    </a>
                    <button onClick={generatePDF} className="w-full sm:w-auto text-center bg-gray-800 text-white px-5 py-3 rounded-xl font-medium hover:bg-gray-900 transition">
                        Télécharger le PDF
                    </button>
                </div>
            </div>
        </div>
    );
}