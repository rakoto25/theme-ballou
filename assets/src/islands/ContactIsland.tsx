import React, { useEffect, useMemo, useRef, useState, FormEvent, useTransition } from "react";

// --- Types (Mise à jour : Ajout unitTag)
type LatLng = { lat: number; lng: number; zoom: number };
type ContactInfo = {
    phone: string;
    email: string;
    facebook: string;
    address: string;
    map: LatLng;
};
type Props = {
    formId: number;
    unitTag: string;  // ← FIX : Unit tag pour CF7 sécurité (wpcf7-f1186-p123-o1)
    nonce: string;
    contactInfo: ContactInfo;
};

type FormDataType = {
    yourName: string;
    yourEmail: string;
    yourSubject: string;
    yourMessage: string;
};

type Notice = { type: "success" | "error"; text: string } | null;
type MapType = 'default' | 'satellite';

// --- Helpers UI (Inchangés : Field, NoticeBanner, MapToggle, LazyMap)
const Field = ({
    id,
    label,
    type = "text",
    value,
    onChange,
    error,
    textarea = false,
    required = true,
}: {
    id: keyof FormDataType;
    label: string;
    type?: "text" | "email";
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    error?: string;
    textarea?: boolean;
    required?: boolean;
}) => (
    <div>
        <label htmlFor={id as string} className="block text-sm font-medium text-zinc-700 mb-1">
            {label} {required && "*"}
        </label>
        {textarea ? (
            <textarea
                id={id as string}
                name={id}
                rows={4}
                value={value}
                onChange={onChange}
                className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] ${error ? "border-red-500" : "border-zinc-300"}`}
                required={required}
            />
        ) : (
            <input
                id={id as string}
                name={id}
                type={type}
                value={value}
                onChange={onChange}
                className={`w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] ${error ? "border-red-500" : "border-zinc-300"}`}
                required={required}
            />
        )}
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
);

const NoticeBanner = ({ notice }: { notice: Notice }) =>
    notice ? (
        <div
            role="status"
            aria-live="polite"
            className={`p-4 rounded-xl mb-6 text-center ${notice.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
        >
            {notice.text}
        </div>
    ) : null;

const MapToggle = ({ mapType, onToggle }: { mapType: MapType; onToggle: () => void }) => (
    <button
        onClick={onToggle}
        className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-lg p-2 shadow-md border border-zinc-200 transition-all text-[var(--brand-primary)] text-sm font-medium"
        title={mapType === 'default' ? 'Vue satellite' : 'Vue classique'}
    >
        {mapType === 'default' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9h18v6H3zM3 5v2h18V5H3zm0 8v2h18v-2H3z" />
            </svg>
        ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z" />
            </svg>
        )}
    </button>
);

const LazyMap = ({ position }: { position: LatLng }) => {
    const [ready, setReady] = useState(false);
    const [visible, setVisible] = useState(false);
    const [error, setError] = useState(false);
    const [mapType, setMapType] = useState<MapType>('default');
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [MapComponents, setMapComponents] = useState<any>(null);
    const [L, setL] = useState<any>(null);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        if (!wrapRef.current) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setVisible(true);
                    io.disconnect();
                }
            },
            { threshold: 0.2 }
        );
        io.observe(wrapRef.current);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (!visible) return;
        // CSS Leaflet (sans SRI)
        if (!document.querySelector('link[href*="leaflet.css"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            document.head.appendChild(link);
        }
        const timeout = setTimeout(() => setReady(true), 150);
        return () => clearTimeout(timeout);
    }, [visible]);

    useEffect(() => {
        if (!ready || error) return;
        let cancelled = false;
        (async () => {
            try {
                const leafletModule = await import("leaflet");
                const reactLeafletModule = await import("react-leaflet");
                if (!cancelled) {
                    if (import.meta.env.DEV) {
                        console.log("[Contact] MapComponents loaded:", reactLeafletModule);  // ← DEBUG : Vérifiez exports (core seulement)
                    }
                    // Global L pour react-leaflet
                    if (typeof window !== 'undefined') {
                        (window as any).L = leafletModule.default;
                    }
                    setL(leafletModule.default);
                    setMapComponents(reactLeafletModule);
                }
            } catch (e) {
                console.error("[Contact] Leaflet/react-leaflet import failed:", e);
                if (!cancelled) setError(true);
            }
        })();
        return () => { cancelled = true; };
    }, [ready]);

    if (!visible || error) {
        return (
            <div ref={wrapRef} className="relative h-64 md:h-80 rounded-2xl overflow-hidden bg-zinc-200 animate-pulse z-0">
                {error && <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Carte indisponible (vérifiez connexion ; installez react-leaflet si besoin)</p>}
            </div>
        );
    }

    if (!ready || !MapComponents || !L) {
        return (
            <div ref={wrapRef} className="relative h-64 md:h-80 rounded-2xl overflow-hidden bg-zinc-200 animate-pulse z-0" />
        );
    }

    // ← FIX : Destructure core seulement (no LayersControl → no undefined)
    let MapContainer: any, TileLayer: any, Marker: any, Popup: any;
    try {
        ({ MapContainer, TileLayer, Marker, Popup } = MapComponents);
        // Guard : Si core undefined (mismatch install), error
        if (!MapContainer || !TileLayer || !Marker || !Popup) {
            throw new Error("Core react-leaflet components missing (install react-leaflet@4.2.1)");
        }
    } catch (e) {
        console.error("[Contact] Destructure failed:", e);
        setError(true);
        return (
            <div ref={wrapRef} className="relative h-64 md:h-80 rounded-2xl overflow-hidden bg-zinc-200 z-0">
                <p className="absolute inset-0 flex items-center justify-center text-sm text-red-500">Erreur composants carte (react-leaflet manquant)</p>
            </div>
        );
    }

    // Fix icônes
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    const pos: [number, number] = [position.lat, position.lng];
    // ← Toggle simple : URL conditionnelle (switch layer au re-render) – Classique OSM / Satellite Esri
    const tileUrl = mapType === 'default'
        ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const attribution = mapType === 'default'
        ? '&copy; OpenStreetMap contributors'
        : '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

    return (
        <div ref={wrapRef} className="relative h-64 md:h-80 rounded-2xl overflow-hidden z-0">
            <MapContainer center={pos} zoom={position.zoom} style={{ height: "100%", width: "100%" }} ref={mapRef}>
                <TileLayer attribution={attribution} url={tileUrl} />
                <Marker position={pos}>
                    <Popup>
                        Ballou — Rue Docteur Joseph Raseta, Anosivita Boina, 6e Arrondissement, Madagascar <br />
                        <a href={`https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=${position.zoom}/${position.lat}/${position.lng}`} target="_blank" rel="noopener">Voir sur la carte</a>
                    </Popup>
                </Marker>
            </MapContainer>
            <MapToggle mapType={mapType} onToggle={() => setMapType(prev => prev === 'default' ? 'satellite' : 'default')} />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5 rounded-2xl" />
        </div>
    );
};

// --- Main Component (Ajout unitTag)
const ContactIsland: React.FC<Props> = ({ formId, unitTag, nonce, contactInfo }) => {
    useEffect(() => {
        document.documentElement.style.setProperty("--brand-primary", "#29235c");
        document.documentElement.style.setProperty("--brand-accent", "#e94e1b");
        document.documentElement.style.setProperty("--brand-dark", "#1b1919");
        document.documentElement.style.setProperty("--brand-light", "#ffffff");
    }, []);

    const [formData, setFormData] = useState<FormDataType>({
        yourName: "",
        yourEmail: "",
        yourSubject: "",
        yourMessage: "",
    });
    const [errors, setErrors] = useState<Partial<Record<keyof FormDataType, string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState<Notice>(null);
    const [isPending, startTransition] = useTransition();

    const position = useMemo(() => contactInfo.map, [contactInfo.map]);

    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((p) => ({ ...p, [name]: value }));
        if (errors[name as keyof FormDataType]) {
            setErrors((pr) => ({ ...pr, [name]: "" }));
        }
    };

    const validate = (d: FormDataType) => {
        const e: Partial<Record<keyof FormDataType, string>> = {};
        if (!d.yourName.trim()) e.yourName = "Le nom est requis.";
        if (!d.yourEmail.trim() || !/\S+@\S+\.\S+/.test(d.yourEmail)) e.yourEmail = "Email valide requis.";
        if (!d.yourSubject.trim()) e.yourSubject = "Sujet requis.";
        // ← FIX : Message optionnel (match [textarea sans *] en CF7 ; retirez if si requis)
        // if (!d.yourMessage.trim()) e.yourMessage = "Message requis.";
        return e;
    };

    const onSubmit = async (ev: FormEvent<HTMLFormElement>) => {
        ev.preventDefault();
        const e = validate(formData);
        if (Object.keys(e).length) {
            setErrors(e);
            return;
        }
        setSubmitting(true);
        setNotice(null);
        startTransition(async () => {
            try {
                const base = (window as any).BALLOU_API_BASE || "/wp-json";
                const url = `${base}/contact-form-7/v1/contact-forms/${formId}/feedback`;
                if (import.meta.env.DEV) console.log("[Contact] Submitting to:", url, {
                    formId,
                    unitTag,  // ← DEBUG : Log unitTag
                    nonce: nonce.substring(0, 10) + '...'
                });

                // ← FIX : FormData avec unitTag (simule native CF7)
                const formBody = new FormData();
                formBody.append("your-name", formData.yourName);
                formBody.append("your-email", formData.yourEmail);
                formBody.append("your-subject", formData.yourSubject);
                formBody.append("your-message", formData.yourMessage);
                formBody.append('_wpcf7_unit_tag', unitTag);  // ← FIX : Unit tag requis (no 400 "no valid unit tag")
                // Si reCAPTCHA activé en CF7, ajoutez : formBody.append('_wpcf7_recaptcha_response', '');  // Ou token réel

                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "X-WP-Nonce": nonce  // Seul header ; no Content-Type
                    },
                    body: formBody,
                });

                if (import.meta.env.DEV) {
                    console.log("[Contact] Response status:", res.status, res.headers.get('content-type'));
                }

                const json = await res.json();
                if (import.meta.env.DEV) {
                    console.log("[Contact] CF7 Response full:", json);  // ← DEBUG : Log JSON (status, message)
                }

                if (res.ok && (json.status === "mail_sent_ok" || json.status === "mail_sent_ng")) {
                    setNotice({ type: "success", text: "Message envoyé avec succès !" });
                    setFormData({ yourName: "", yourEmail: "", yourSubject: "", yourMessage: "" });
                    setErrors({});
                } else {
                    let errorMsg = json?.message || "Erreur lors de l’envoi. Veuillez réessayer.";
                    if (res.status === 400 && (json.status === "wpcf7_unit_tag_not_found" || errorMsg.includes("balise d’unité"))) {
                        errorMsg = "Unit tag invalide (vérifiez config CF7 ID 1186 ; Mail tab sans tags invalides).";
                    } else if (res.status === 415 || json.status === "uploaded_file_error") {
                        errorMsg = "Format non supporté (supprimez [file] en CF7).";
                    } else if (res.status === 404) {
                        errorMsg = `Formulaire ID ${formId} introuvable.`;
                    } else if (json.status === "validation_failed") {
                        errorMsg = "Champs mismatch CF7 (vérifiez mail-tags [your-name] etc.).";
                    }
                    setNotice({ type: "error", text: errorMsg });
                    if (json?.invalid_fields?.length) {
                        const fe: Partial<Record<keyof FormDataType, string>> = {};
                        json.invalid_fields.forEach((f: any) => {
                            const key = (f.into?.split(".").pop() || "") as keyof FormDataType;
                            if (key) fe[key] = f.message;
                        });
                        setErrors(fe);
                    }
                }
            } catch (err) {
                if (import.meta.env.DEV) console.error("[Contact] Submit error:", err);
                setNotice({ type: "error", text: "Erreur réseau. Vérifiez votre connexion." });
            } finally {
                setSubmitting(false);
            }
        });
    };

    return (
        <div className="mx-auto max-w-5xl">
            {/* Hero (Inchangé) */}
            <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 mb-10"
                style={{ background: "linear-gradient(135deg, var(--brand-primary), #3b3578)" }}>
                <div className="absolute -top-24 -right-24 size-72 rounded-full blur-3xl opacity-20"
                    style={{ background: "radial-gradient(circle, var(--brand-accent), transparent 60%)" }} />
                <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight text-center">
                    Contactez-nous
                </h1>
                <p className="mt-3 text-white/80 text-center max-w-2xl mx-auto">
                    Nous sommes à votre écoute pour vos questions, devis ou partenariats.
                </p>
            </div>

            {/* Infos + Carte (Adresse et Coordonnées Réelles) */}
            <div className="grid md:grid-cols-2 gap-8 mb-12">
                <div className="space-y-5">
                    <h2 className="text-xl md:text-2xl font-semibold text-[var(--brand-primary)]">
                        Nos coordonnées
                    </h2>
                    <div className="rounded-2xl border border-zinc-200 p-5 bg-white shadow-sm">
                        <ul className="space-y-3 text-zinc-800">
                            <li className="flex items-start gap-3">
                                <svg width="20" height="20" viewBox="0 0 24 24" className="mt-0.5 text-[var(--brand-accent)]">
                                    <path fill="currentColor" d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3c1.2.4 2.5.6 3.8.6c.6 0 1 .4 1 .9V20c0 .6-.4 1-1 1C10.3 21 3 13.7 3 4c0-.6.4-1 1-1h3.5c.5 0 .9.4 .9 1c0 1.3.2 2.6.6 3.8c.1.4 0 .8-.3 1.1z" />
                                </svg>
                                <div>
                                    <div className="text-sm text-zinc-500">Téléphone / WhatsApp</div>
                                    <a href={`tel:${contactInfo.phone}`} className="font-medium hover:underline text-[var(--brand-accent)]">
                                        {contactInfo.phone}
                                    </a>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg width="20" height="20" viewBox="0 0 24 24" className="mt-0.5 text-[var(--brand-accent)]">
                                    <path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v.4l10 6l10-6V6a2 2 0 0 0-2-2m0 4.5l-8.8 5.3L2 8.5V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z" />
                                </svg>
                                <div>
                                    <div className="text-sm text-zinc-500">Email</div>
                                    <a href={`mailto:${contactInfo.email}`} className="font-medium hover:underline text-[var(--brand-accent)]">
                                        {contactInfo.email}
                                    </a>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg width="20" height="20" viewBox="0 0 24 24" className="mt-0.5 text-[var(--brand-accent)]">
                                    <path fill="currentColor" d="M17 2H7A5 5 0 0 0 2 7v10a5 5 0 0 0 5 5h5v-7H9v-3h3V9.5C12 6.9 13.6 5 16.4 5c1 0 1.9.1 2.6.2V8h-1.8C15.9 8 15 8.7 15 10V12h3.2l-.5 3H15v7h2a5 5 0 0 0 5-5V7a5 5 0 0 0-5-5" />
                                </svg>
                                <div>
                                    <div className="text-sm text-zinc-500">Facebook</div>
                                    <a href={contactInfo.facebook} target="_blank" rel="noopener" className="font-medium hover:underline text-[var(--brand-accent)]">
                                        Visitez notre page
                                    </a>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <svg width="20" height="20" viewBox="0 0 24 24" className="mt-0.5 text-[var(--brand-accent)]">
                                    <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5" />
                                </svg>
                                <div>
                                    <div className="text-sm text-zinc-500">Adresse</div>
                                    <div className="font-medium">{contactInfo.address}</div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <LazyMap position={position} />  {/* Coordonnées : -18.880389, 47.50617 ; Toggle classique/satellite */}
            </div>

            {/* Formulaire (Inchangé) */}
            <div className="relative bg-white rounded-3xl border border-zinc-200 p-6 md:p-10 shadow-sm">
                <div className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ background: "var(--brand-primary)" }}>
                    Nous écrire
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold text-[var(--brand-primary)] text-center mb-6">
                    Envoyez-nous un message
                </h2>
                <NoticeBanner notice={notice} />
                <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <Field id="yourName" label="Nom" value={formData.yourName} onChange={onChange} error={errors.yourName} />
                    <Field id="yourEmail" label="Email" type="email" value={formData.yourEmail} onChange={onChange} error={errors.yourEmail} />
                    <Field id="yourSubject" label="Sujet" value={formData.yourSubject} onChange={onChange} error={errors.yourSubject} />
                    <div className="md:col-span-2">
                        <Field id="yourMessage" label="Message" value={formData.yourMessage} onChange={onChange} error={errors.yourMessage} textarea />
                    </div>
                    <button
                        type="submit"
                        disabled={submitting || isPending}
                        className="md:col-span-2 w-full inline-flex items-center justify-center gap-2 font-semibold py-3 rounded-xl text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{ background: "linear-gradient(90deg, var(--brand-accent), #ff7b4d)" }}
                    >
                        {submitting || isPending ? "Envoi en cours…" : "Envoyer"}
                        {!submitting && !isPending && (
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path fill="currentColor" d="m3.4 21l18.3-9L3.4 3l-.1 7l13 2l-13 2z" />
                            </svg>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ContactIsland;