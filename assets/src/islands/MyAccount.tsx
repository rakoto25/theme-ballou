import React, { useEffect, useMemo, useState } from "react";

/* =================
   Types
================= */
interface UserData {
    id: number;
    display_name: string;
    email: string;
    first_name: string;
    last_name: string;
}
interface Order {
    id: number;
    date: string;
    status: string;
    total: string;
    view_url: string;
}
interface Address {
    [key: string]: string;
}
interface Props {
    user: UserData;
    orders: Order[];
    billing_address: Address;
    shipping_address: Address;
    logout_url: string;
    edit_account_url: string;
}

/* =================
   API helpers
================= */
const getApiInfo = () => ({
    nonce: (window as any).wcApiData?.nonce || "",
    home_url: (window as any).wcApiData?.home_url || window.location.origin + "/",
});

async function apiFetch<T>(endpoint: string, opts: RequestInit = {}): Promise<T> {
    const { nonce, home_url } = getApiInfo();
    const url = `${home_url.replace(/\/+$/, "")}/wp-json/${endpoint.replace(/^\/+/, "")}`;

    const res = await fetch(url, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": nonce,
            Accept: "application/json",
            ...(opts.headers || {}),
        },
        ...opts,
    });

    const text = await res.text();
    let json: any = {};
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`Réponse non JSON : ${text.slice(0, 100)}...`);
    }

    if (!res.ok) throw new Error(json.message || `Erreur HTTP ${res.status}`);
    return json as T;
}

const api = {
    listOrders: async (page = 1, perPage = 10): Promise<{ items: Order[]; hasMore: boolean }> => {
        return apiFetch(`ballou/v1/account/orders?page=${page}&per_page=${perPage}`);
    },
    updateMe: async (payload: {
        first_name?: string;
        last_name?: string;
        email?: string;
        billing?: Address;
        shipping?: Address;
        new_password?: string;
    }): Promise<{ success: boolean; message: string }> => {
        return apiFetch("ballou/v1/account/me", {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },
};

/* ============== UI small utils ============== */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cx("animate-pulse rounded bg-zinc-200", className)} />
);
const Toast: React.FC<{ tone: "ok" | "err"; msg: string }> = ({ tone, msg }) => (
    <div
        className={cx(
            "mt-3 rounded-lg px-3 py-2 text-sm",
            tone === "ok" && "bg-green-100 text-green-800",
            tone === "err" && "bg-red-100 text-red-700"
        )}
    >
        {msg}
    </div>
);
const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15">
        <span className="inline-block h-2 w-2 rounded-full bg-white/80" />
        {children}
    </span>
);

/* =================
   Composant principal
================= */
const MyAccount: React.FC<Props> = (props) => {
    const [tab, setTab] = useState<"dash" | "orders" | "addresses" | "account">("dash");
    const [orders, setOrders] = useState<Order[]>(props.orders || []);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(false);

    useEffect(() => {
        if ((props.orders || []).length < 5) loadOrders(1, true);
    }, []);

    async function loadOrders(nextPage: number, replace = false) {
        setLoadingOrders(true);
        try {
            const { items, hasMore } = await api.listOrders(nextPage, 10);
            setHasMore(hasMore);
            setPage(nextPage);
            setOrders((prev) => (replace ? items : [...prev, ...items]));
        } catch (e) {
            console.error("Erreur chargement commandes :", e);
        } finally {
            setLoadingOrders(false);
        }
    }

    // Correction payload : Inclure top-level first_name/last_name/email (du user actuel), et clés non-préfixées dans billing/shipping pour matcher backend
    const handleUpdateAddresses = async (billingForm: Address, shippingForm: Address) => {
        const payload = {
            first_name: props.user.first_name || '',  // Toujours inclure top-level pour validation backend
            last_name: props.user.last_name || '',
            email: props.user.email || '',
            // Clés non-préfixées dans billing/shipping (comme attendu par ballou_apply_address)
            billing: {
                first_name: (billingForm.first_name || props.user.first_name || '').trim(),
                last_name: (billingForm.last_name || props.user.last_name || '').trim(),
                address_1: (billingForm.address_1 || '').trim(),
                address_2: (billingForm.address_2 || '').trim(),
                city: (billingForm.city || '').trim(),
                postcode: (billingForm.postcode || '').trim(),
                state: (billingForm.state || '').trim(),
                country: (billingForm.country || '').trim().toUpperCase(),
                phone: (billingForm.phone || '').trim(),
                // company/email optionnels, vides OK
            },
            shipping: {
                first_name: (shippingForm.first_name || props.user.first_name || '').trim(),
                last_name: (shippingForm.last_name || props.user.last_name || '').trim(),
                address_1: (shippingForm.address_1 || '').trim(),
                address_2: (shippingForm.address_2 || '').trim(),
                city: (shippingForm.city || '').trim(),
                postcode: (shippingForm.postcode || '').trim(),
                state: (shippingForm.state || '').trim(),
                country: (shippingForm.country || '').trim().toUpperCase(),
                phone: (shippingForm.phone || '').trim(),
            },
        };
        // Ignorer billing/shipping si vides (backend gère)
        if (!payload.billing.address_1 && !payload.billing.city && !payload.billing.country) delete payload.billing;
        if (!payload.shipping.address_1 && !payload.shipping.city && !payload.shipping.country) delete payload.shipping;
        console.log("Payload corrigé envoyé pour adresses :", JSON.stringify(payload, null, 2));  // Debug
        return api.updateMe(payload);
    };

    return (
        <div className="mx-auto my-8 max-w-5xl px-4">
            <header className="mb-6">
                <Badge>Mon espace</Badge>
                <h1 className="mt-3 text-3xl font-bold text-zinc-900">
                    Bonjour, {props.user.display_name}
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                    Gérez vos commandes, adresses et informations personnelles.
                </p>
            </header>

            {/* Tabs */}
            <div
                role="tablist"
                aria-label="Sections du compte"
                className="flex gap-2 overflow-x-auto border-b border-zinc-200 pb-2"
            >
                {[
                    { id: "dash", label: "Tableau de bord" },
                    { id: "orders", label: "Commandes" },
                    { id: "addresses", label: "Adresses" },
                    { id: "account", label: "Détails du compte" },
                ].map((t) => (
                    <button
                        key={t.id}
                        role="tab"
                        aria-selected={tab === t.id}
                        className={cx(
                            "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition",
                            tab === t.id
                                ? "bg-zinc-900 text-white"
                                : "text-zinc-600 hover:bg-zinc-100"
                        )}
                        onClick={() => setTab(t.id as any)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <section className="pt-6">
                {tab === "dash" && <Dashboard user={props.user} logoutUrl={props.logout_url} />}
                {tab === "orders" && (
                    <Orders
                        items={orders}
                        loading={loadingOrders}
                        hasMore={hasMore}
                        onLoadMore={() => loadOrders(page + 1)}
                    />
                )}
                {tab === "addresses" && (
                    <Addresses
                        billing={props.billing_address}
                        shipping={props.shipping_address}
                        user={props.user}
                        onSubmit={handleUpdateAddresses}
                    />
                )}
                {tab === "account" && <AccountDetails user={props.user} onSubmit={api.updateMe} />}
            </section>
        </div>
    );
};

/* =================
   Sous-composants
================= */
const Dashboard: React.FC<{ user: UserData; logoutUrl: string }> = ({ user, logoutUrl }) => (
    <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-900">Profil</h3>
            <dl className="mt-3 text-sm text-zinc-700">
                <div className="flex justify-between border-b py-2">
                    <dt>Email</dt>
                    <dd>{user.email}</dd>
                </div>
                <div className="flex justify-between border-b py-2">
                    <dt>Prénom</dt>
                    <dd>{user.first_name || "—"}</dd>
                </div>
                <div className="flex justify-between py-2">
                    <dt>Nom</dt>
                    <dd>{user.last_name || "—"}</dd>
                </div>
            </dl>
            <a
                href={logoutUrl}
                className="mt-4 inline-block text-sm text-zinc-600 underline hover:text-zinc-900"
            >
                Déconnexion
            </a>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-900">Conseils</h3>
            <ul className="mt-3 list-disc pl-5 text-sm text-zinc-700">
                <li>Vérifiez vos adresses avant une commande.</li>
                <li>Utilisez un mot de passe robuste et unique.</li>
                <li>Contactez-nous si une commande semble anormale.</li>
            </ul>
        </div>
    </div>
);

/* Commandes avec aperçu interne */
const Orders: React.FC<{
    items: Order[];
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
}> = ({ items, loading, hasMore, onLoadMore }) => {
    const [selected, setSelected] = useState<Order | null>(null);

    if (selected) {
        return (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <button
                    onClick={() => setSelected(null)}
                    className="mb-3 text-sm text-zinc-500 underline hover:text-zinc-700"
                >
                    ← Retour à la liste
                </button>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                    Commande #{selected.id}
                </h3>
                <p className="text-sm text-zinc-600">
                    Passée le {selected.date} — {selected.status}
                </p>
                <p className="mt-4 text-base font-bold text-zinc-900">
                    Total : <span dangerouslySetInnerHTML={{ __html: selected.total }} />
                </p>

                <a
                    href={selected.view_url}
                    target="_blank"
                    rel="noopener"
                    className="mt-4 inline-block rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                    Ouvrir la commande complète →
                </a>
            </div>
        );
    }

    return (
        <div>
            {items.length === 0 && !loading && (
                <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-600">
                    Aucune commande pour le moment.
                </div>
            )}
            <div className="grid gap-3">
                {items.map((o) => (
                    <article
                        key={o.id}
                        className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                    >
                        <div>
                            <div className="text-sm text-zinc-500">Commande</div>
                            <div className="text-base font-semibold text-zinc-900">#{o.id}</div>
                        </div>
                        <div className="hidden text-sm text-zinc-600 md:block">
                            {o.date} — {o.status}
                        </div>
                        <div
                            className="text-base font-bold text-zinc-900"
                            dangerouslySetInnerHTML={{ __html: o.total }}
                        />
                        <button
                            onClick={() => setSelected(o)}
                            className="text-sm font-medium text-zinc-900 underline hover:opacity-75"
                        >
                            Voir
                        </button>
                    </article>
                ))}
            </div>

            {loading && (
                <div className="mt-4 grid gap-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                </div>
            )}

            {hasMore && !loading && (
                <div className="mt-6 text-center">
                    <button
                        onClick={onLoadMore}
                        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                        Charger plus
                    </button>
                </div>
            )}
        </div>
    );
};

/* Select Pays - Composant pour codes ISO */
const SelectCountry: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
}> = ({ label, value, onChange, required }) => {
    const countries = [
        { code: 'FR', label: 'France' },
        { code: 'MG', label: 'Madagascar' },
        { code: 'US', label: 'États-Unis' },
        { code: 'GB', label: 'Royaume-Uni' },
        { code: 'DE', label: 'Allemagne' },
        { code: 'IT', label: 'Italie' },
        { code: 'ES', label: 'Espagne' },
        { code: 'BE', label: 'Belgique' },
        { code: 'CH', label: 'Suisse' },
        { code: 'MA', label: 'Maroc' },
        { code: 'TN', label: 'Tunisie' },
        { code: 'RE', label: 'Réunion' },  // Ajout pour cas freight
    ];
    return (
        <label className="text-sm">
            <span className="mb-1 block text-zinc-700">{label} {required && '*'}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className={cx(
                    "w-full rounded-lg border px-3 py-2 outline-none transition",
                    "border-zinc-300 focus:border-zinc-900"
                )}
            >
                <option value="">Sélectionnez un pays</option>
                {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                        {c.label} ({c.code})
                    </option>
                ))}
            </select>
        </label>
    );
};

/* Adresses - Éditables prénom/nom, select pays, mapping init non-préfixé, validation ISO + postcode */
const Addresses: React.FC<{
    billing: Address;
    shipping: Address;
    user: UserData;
    onSubmit: (billing: Address, shipping: Address) => Promise<{ success: boolean; message: string }>;
}> = ({ billing, shipping, user, onSubmit }) => {
    const [editing, setEditing] = useState(false);

    // Mapping init : Clés Woo → form (dépréfrixées, car backend renvoie non-préfixées dans GET)
    const initBilling = useMemo(() => ({
        first_name: billing.first_name || user.first_name || '',
        last_name: billing.last_name || user.last_name || '',
        address_1: billing.address_1 || '',
        address_2: billing.address_2 || '',
        city: billing.city || '',
        postcode: billing.postcode || '',
        state: billing.state || '',
        country: billing.country || '',
        phone: billing.phone || '',
    }), [billing, user]);
    const initShipping = useMemo(() => ({
        first_name: shipping.first_name || user.first_name || '',
        last_name: shipping.last_name || user.last_name || '',
        address_1: shipping.address_1 || '',
        address_2: shipping.address_2 || '',
        city: shipping.city || '',
        postcode: shipping.postcode || '',
        state: shipping.state || '',
        country: shipping.country || '',
        phone: shipping.phone || '',
    }), [shipping, user]);

    const [billingForm, setBillingForm] = useState<Address>(initBilling);
    const [shippingForm, setShippingForm] = useState<Address>(initShipping);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        // Trim et validation étendue : Requis + ISO pays + postcode basique (chiffres)
        const trimmedBilling = {
            first_name: billingForm.first_name?.trim() || '',
            last_name: billingForm.last_name?.trim() || '',
            address_1: billingForm.address_1?.trim() || '',
            city: billingForm.city?.trim() || '',
            country: billingForm.country?.trim() || '',
            postcode: billingForm.postcode?.trim() || '',
        };
        const trimmedShipping = {
            first_name: shippingForm.first_name?.trim() || '',
            last_name: shippingForm.last_name?.trim() || '',
            address_1: shippingForm.address_1?.trim() || '',
            city: shippingForm.city?.trim() || '',
            country: shippingForm.country?.trim() || '',
            postcode: shippingForm.postcode?.trim() || '',
        };
        if (
            !trimmedBilling.address_1 ||
            !trimmedBilling.city ||
            !/^[A-Z]{2}$/.test(trimmedBilling.country) ||
            !trimmedShipping.address_1 ||
            !trimmedShipping.city ||
            !/^[A-Z]{2}$/.test(trimmedShipping.country) ||
            (trimmedBilling.postcode && !/^\d{2,10}$/.test(trimmedBilling.postcode)) ||
            (trimmedShipping.postcode && !/^\d{2,10}$/.test(trimmedShipping.postcode))
        ) {
            setToast({ tone: "err", msg: "Vérifiez : Adresse/ville/pays ISO (ex. FR/MG) obligatoires ; postcode (chiffres seulement, ex. 75001) optionnel mais valide." });
            return;
        }
        setBusy(true);
        try {
            const res = await onSubmit(trimmedBilling, trimmedShipping);
            console.log("Réponse API update addresses :", res);  // Debug
            setToast({ tone: res.success ? "ok" : "err", msg: res.message || (res.success ? "Adresses mises à jour !" : "Erreur : vérifiez les champs ou console.") });
            if (res.success) {
                setEditing(false);
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (err: any) {
            console.error("Erreur update addresses :", err);  // Debug
            setToast({ tone: "err", msg: err?.message || "Erreur mise à jour adresses (vérifiez console pour détails)." });
        } finally {
            setBusy(false);
        }
    }

    if (!editing) {
        return (
            <div className="space-y-4">
                <button
                    onClick={() => setEditing(true)}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                    Modifier adresses
                </button>
                <div className="grid gap-4 md:grid-cols-2">
                    <AddressCard title="Facturation" addr={billing} />
                    <AddressCard title="Livraison" addr={shipping} />
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => setEditing(false)} className="text-sm text-zinc-600 underline">
                    Annuler
                </button>
                {busy && <span className="text-sm text-zinc-500">Enregistrement…</span>}
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <Fieldset title="Facturation">
                    <Input
                        label="Prénom *"
                        value={billingForm.first_name || ""}
                        onChange={(v) => setBillingForm({ ...billingForm, first_name: v })}
                        required
                    />
                    <Input
                        label="Nom *"
                        value={billingForm.last_name || ""}
                        onChange={(v) => setBillingForm({ ...billingForm, last_name: v })}
                        required
                    />
                    <Input
                        label="Adresse 1 *"
                        value={billingForm.address_1 || ""}
                        onChange={(v) => setBillingForm({ ...billingForm, address_1: v })}
                        required
                    />
                    <Input
                        label="Adresse 2 (optionnel)"
                        value={billingForm.address_2 || ""}
                        onChange={(v) => setBillingForm({ ...billingForm, address_2: v })}
                    />
                    <Input
                        label="Ville *"
                        value={billingForm.city || ""}
                        onChange={(v) => setBillingForm({ ...billingForm, city: v })}
                        required
                    />
                    <Input
                        label="Code postal (ex. 75001)"
                        value={billingForm.postcode || ""}
                        onChange={(v) => setBillingForm({ ...billingForm, postcode: v })}
                    />
                    <Input
                        label="État/Région (ex. 75 pour Paris ; optionnel pour MG)"
                        value={billingForm.state || ""}
                        onChange={(v) => setBillingForm({ ...billingForm, state: v })}
                    />
                    <SelectCountry
                        label="Pays *"
                        value={billingForm.country || ""}
                        onChange={(v) => setBillingForm({ ...billingForm, country: v })}
                        required
                    />
                    <Input
                        label="Téléphone (optionnel)"
                        value={billingForm.phone || ""}
                        onChange={(v) => setBillingForm({ ...billingForm, phone: v })}
                    />
                </Fieldset>
                <Fieldset title="Livraison">
                    <Input
                        label="Prénom *"
                        value={shippingForm.first_name || ""}
                        onChange={(v) => setShippingForm({ ...shippingForm, first_name: v })}
                        required
                    />
                    <Input
                        label="Nom *"
                        value={shippingForm.last_name || ""}
                        onChange={(v) => setShippingForm({ ...shippingForm, last_name: v })}
                        required
                    />
                    <Input
                        label="Adresse 1 *"
                        value={shippingForm.address_1 || ""}
                        onChange={(v) => setShippingForm({ ...shippingForm, address_1: v })}
                        required
                    />
                    <Input
                        label="Adresse 2 (optionnel)"
                        value={shippingForm.address_2 || ""}
                        onChange={(v) => setShippingForm({ ...shippingForm, address_2: v })}
                    />
                    <Input
                        label="Ville *"
                        value={shippingForm.city || ""}
                        onChange={(v) => setShippingForm({ ...shippingForm, city: v })}
                        required
                    />
                    <Input
                        label="Code postal (ex. 75001)"
                        value={shippingForm.postcode || ""}
                        onChange={(v) => setShippingForm({ ...shippingForm, postcode: v })}
                    />
                    <Input
                        label="État/Région (optionnel)"
                        value={shippingForm.state || ""}
                        onChange={(v) => setShippingForm({ ...shippingForm, state: v })}
                    />
                    <SelectCountry
                        label="Pays *"
                        value={shippingForm.country || ""}
                        onChange={(v) => setShippingForm({ ...shippingForm, country: v })}
                        required
                    />
                    <Input
                        label="Téléphone (optionnel)"
                        value={shippingForm.phone || ""}
                        onChange={(v) => setShippingForm({ ...shippingForm, phone: v })}
                    />
                </Fieldset>
            </div>
            <button
                disabled={busy}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {busy ? "Mise à jour…" : "Mettre à jour les adresses"}
            </button>
            {toast && <Toast tone={toast.tone} msg={toast.msg} />}
        </form>
    );
};

const AddressCard = ({ title, addr }: { title: string; addr: Address }) => (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-zinc-900">{title}</h3>
        <p className="mt-2 text-sm text-zinc-700">
            {addr.first_name || ''} {addr.last_name || ''}
        </p>
        <p className="text-sm text-zinc-700">{addr.address_1 || "—"}</p>
        {addr.address_2 && <p className="text-sm text-zinc-700">{addr.address_2}</p>}
        <p className="text-sm text-zinc-700">{[addr.postcode, addr.city].filter(Boolean).join(" ")}</p>
        {addr.state && <p className="text-sm text-zinc-700">État : {addr.state}</p>}
        <p className="text-sm text-zinc-700">
            {addr.country ? `Pays : ${addr.country}` : ''}
        </p>
        {addr.phone && <p className="text-sm text-zinc-700">Tél : {addr.phone}</p>}
    </div>
);

/* Formulaire détails compte */
const AccountDetails: React.FC<{
    user: UserData;
    onSubmit: (data: {
        first_name: string;
        last_name: string;
        email: string;
        new_password?: string;
    }) => Promise<{ success: boolean; message: string }>;
}> = ({ user, onSubmit }) => {
    const [form, setForm] = useState({ first_name: user.first_name || "", last_name: user.last_name || "", email: user.email || "" });
    const [pwd, setPwd] = useState({ password: "", confirm: "" });
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);

    const emailOk = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email), [form.email]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!emailOk) return setToast({ tone: "err", msg: "Email invalide." });
        if (pwd.password && pwd.password !== pwd.confirm) return setToast({ tone: "err", msg: "Mots de passe non identiques." });

        setBusy(true);
        try {
            const res = await onSubmit({
                first_name: form.first_name,
                last_name: form.last_name,
                email: form.email,
                new_password: pwd.password || undefined,
            });
            setToast({ tone: res.success ? "ok" : "err", msg: res.message });
            if (res.success) setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            setToast({ tone: "err", msg: err?.message || "Erreur mise à jour." });
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                <Input label="Prénom *" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} required />
                <Input label="Nom *" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} required />
            </div>
            <Input label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} invalid={!emailOk} required />
            <div className="grid gap-4 md:grid-cols-2">
                <Input label="Nouveau mot de passe" type="password" value={pwd.password} onChange={(v) => setPwd({ ...pwd, password: v })} />
                <Input label="Confirmer" type="password" value={pwd.confirm} onChange={(v) => setPwd({ ...pwd, confirm: v })} />
            </div>
            <button disabled={busy} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            {toast && <Toast tone={toast.tone} msg={toast.msg} />}
        </form>
    );
};

/* UI Components */
const Fieldset: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <fieldset className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <legend className="mb-3 px-1 text-sm font-semibold text-zinc-900">{title}</legend>
        <div className="grid gap-2">{children}</div>
    </fieldset>
);
const Input: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    required?: boolean;
    invalid?: boolean;
    disabled?: boolean;
}> = ({ label, value, onChange, type = "text", required, invalid, disabled = false }) => (
    <label className="text-sm">
        <span className="mb-1 block text-zinc-700">{label} {required && '*'}</span>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            disabled={disabled}
            className={cx(
                "w-full rounded-lg border px-3 py-2 outline-none transition disabled:bg-gray-100 disabled:cursor-not-allowed",
                "border-zinc-300 focus:border-zinc-900",
                invalid && "border-red-400 focus:border-red-500",
                disabled && "opacity-60"
            )}
        />
    </label>
);

export default MyAccount;