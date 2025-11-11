import React, { useRef, useEffect } from "react";

/* --- Typages globaux min pour le SDK FB (utile uniquement si XFBML activé) --- */
declare global {
    interface Window {
        FB?: {
            init: (opts: { xfbml: boolean; version: string; appId?: string }) => void;
            XFBML: { parse: (dom?: Element) => void };
        };
        fbAsyncInit?: () => void;
    }
}

/* --- Types (Props de PHP) : Ajout de ? pour optionnel, évite undefined --- */
type MenuItem = { title: string; url: string };
type SocialLink = { title: string; url: string };
type Props = {
    menuItems?: MenuItem[];      // Rang 2 : Liens WP (Contact, etc.)
    socialLinks?: SocialLink[];  // Copyright + Rang 3 (Insta, FB, LinkedIn, etc.)
    address?: string;            // Rang 1
    logoBallou?: string;         // Rang 1 : URL img/SVG (via API)
    logoBallouPro?: string;      // Rang 2 : URL img
    fbPageUrl?: string;          // Rang 3 : URL publique de la Page (fallback)
    fbPageId?: string;           // ← NOUVEAU : ID numérique de la page (pour embed direct + image)
    latestNewsEmbed?: string;    // Rang 3 : src iframe du plugin
};

/* === Modes : IFRAME auto-activé si appId ; sinon fallback (recommandé) ; XFBML optionnel --- */
const FB_APP_ID = '';  // ← REMPLACEZ PAR VOTRE APP ID (ex: '1234567890123456') ; si vide, USE_IFRAME=false → fallback
const USE_IFRAME = !!FB_APP_ID;  // ← Auto : true si appId présent, else false → fallback
const USE_XFBML = false;  // true seulement si appId et SDK global (rare) ; gardez false

/* --- Helper : Construit URL iframe seulement si valide (évite refus) --- */
function toPagePluginSrc(fbPageId?: string, fbPageUrl?: string, fallbackWidth = 500, height = 250): string {
    let href: string;
    if (fbPageId && /^\d+$/.test(fbPageId)) {  // Si ID numérique valide
        href = fbPageId;  // Direct : ?href=100064876740503
    } else if (fbPageUrl?.startsWith('https://www.facebook.com/')) {
        href = encodeURIComponent(fbPageUrl);
    } else {
        console.warn('fbPageId ou fbPageUrl invalide ; fallback activé');
        return '';
    }
    const base = "https://www.facebook.com/plugins/page.php";
    let params = `?href=${href}&tabs=timeline&width=${fallbackWidth}&height=${height}&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`;
    if (FB_APP_ID) params += `&appId=${FB_APP_ID}`;
    return base + params;
}

/* --- Helper : Normalise src ; retourne '' si invalide pour forcer fallback --- */
function normalizeEmbedSrc(latestNewsEmbed?: string, fbPageId?: string, fbPageUrl?: string): string {
    const clean = (latestNewsEmbed ?? '').trim();
    if (!clean) return toPagePluginSrc(fbPageId, fbPageUrl);
    try {
        const u = new URL(clean);
        if (u.hostname === "www.facebook.com" && u.pathname === "/plugins/page.php") {
            if (FB_APP_ID && !u.searchParams.has('appId')) u.searchParams.set('appId', FB_APP_ID);
            return u.toString();
        }
        return toPagePluginSrc(fbPageId, fbPageUrl);  // Reconstruit si malformé
    } catch {
        return toPagePluginSrc(fbPageId, fbPageUrl);
    }
}

/* --- Composant Fallback : Fix image via username (plus fiable) + teaser statique --- */
const FacebookFallback: React.FC<{ fbPageUrl?: string; fbPageId?: string }> = ({ fbPageUrl, fbPageId }) => {
    // Utilise username du fbPageUrl (ex: 'ballou.madagascar') – plus stable que ID pour /picture
    const username = fbPageUrl?.split('/').pop()?.replace('@', '') || '';  // Nettoie si @username
    const profilePicUrl = username ? `https://graph.facebook.com/v18.0/${username}/picture?type=large` : '';
    // Fallback local : Ajoutez une image statique Ballou dans /assets/images/fb-profile-placeholder.jpg (téléchargez depuis FB page)

    return (
        <div className="w-full min-h-[350px] p-4 bg-blue-50 border border-blue-200 rounded-md text-center flex flex-col justify-center items-center">
            {/* Image Profil (via username – publique) */}
            <div className="mb-4">
                <img
                    src={profilePicUrl || '/assets/images/fb-profile-placeholder.jpg'}  // ← Local si échec (ajoutez le fichier)
                    alt="Profil Ballou Madagascar"
                    className="w-24 h-24 rounded-full object-cover border-4 border-blue-600 shadow-md"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/assets/images/fb-profile-placeholder.jpg';  // Local fallback
                        target.style.borderColor = '#93c5fd';  // Bordure grise si échec
                    }}
                />
            </div>
            <svg className="w-10 h-10 text-blue-600 mb-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <p className="text-base font-medium text-blue-700 mb-3">Suivez les dernières actualités de Ballou sur Facebook.</p>
            {fbPageUrl && (
                <a
                    href={fbPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-colors shadow-md"
                >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Voir les publications récentes
                </a>
            )}
            {/* Placeholder pour teasers statiques : Ajoutez 2-3 divs manuels ici si besoin (ex. <div className="mt-4 p-2 bg-white rounded">Post exemple</div>) */}
        </div>
    );
};

const Footer: React.FC<Props> = (props) => {  // ← Log pour debug props (supprimez en prod)
    console.log('Footer props reçus:', props);  // Vérifiez fbPageId, fbPageUrl et latestNewsEmbed en F12 > Console
    const {
        menuItems = [],
        socialLinks = [],
        address = '',
        logoBallou = '',
        logoBallouPro = '',
        fbPageUrl = '',
        fbPageId = '',  // ← NOUVEAU : ID page
        latestNewsEmbed = '',
    } = props;

    const fbContainerRef = useRef<HTMLDivElement>(null);
    const [embedError, setEmbedError] = React.useState(!USE_IFRAME);  // Force fallback si pas d'iframe

    /* --- URL iframe : Force fallback si invalide --- */
    const iframeSrc = USE_IFRAME ? normalizeEmbedSrc(latestNewsEmbed, fbPageId, fbPageUrl) : '';

    /* --- CSS Vars : Wrap en try/catch pour éviter TypeError --- */
    useEffect(() => {
        try {
            document.documentElement.style.setProperty("--brand-blue", "#29235c");
            document.documentElement.style.setProperty("--brand-orange", "#e94e1b");
            document.documentElement.style.setProperty("--brand-dark", "#1b1919");
            document.documentElement.style.setProperty("--brand-light", "#f9fafb");
        } catch (e) {
            console.error('Erreur CSS vars:', e);
        }
    }, []);

    /* --- Gestion iframe (seulement si activé) --- */
    useEffect(() => {
        if (!USE_IFRAME || !iframeSrc) {
            setEmbedError(true);
            return;
        }
        const timer = setTimeout(() => setEmbedError(false), 3000);  // Assume load si pas d'erreur en 3s
        return () => clearTimeout(timer);
    }, [iframeSrc]);

    const handleIframeError = () => {
        console.error('Iframe FB refused to connect (X-Frame-Options)');
        setEmbedError(true);
    };

    /* --- Mode XFBML (optionnel ; skip si pas appId) --- */
    useEffect(() => {
        if (!USE_XFBML || !FB_APP_ID || !fbContainerRef.current) return;
        let cancelled = false;
        const parseSafe = () => {
            if (cancelled || !window.FB?.XFBML?.parse) return;
            try {
                window.FB.XFBML.parse(fbContainerRef.current);
            } catch (e) {
                console.error('XFBML parse error:', e);
            }
        };
        parseSafe();
        return () => { cancelled = true; };
    }, [fbPageUrl, FB_APP_ID]);

    /* --- Icons SVG (avec guard title) --- */
    const getIconPath = (title?: string) => {
        const safeTitle = (title ?? '').toLowerCase();
        switch (safeTitle) {
            case "facebook":
                return "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z";
            case "instagram":
                return "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z";
            case "linkedin":
                return "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
            default:
                return "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
        }
    };

    const SocialIcon = ({ url, title }: { url?: string; title?: string }) => (
        <a
            href={url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={title ?? 'Social'}
            className="inline-flex items-center justify-center p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-[var(--brand-light)] hover:text-[var(--brand-orange)]"
        >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d={getIconPath(title)} />
            </svg>
        </a>
    );

    /* --- Placeholder Logo (avec guard) --- */
    const LogoPlaceholder = () => (
        <svg className="mb-4 h-12 w-auto text-[var(--brand-light)]" fill="currentColor" viewBox="0 0 168 168">
            <path d="M0 0h168v168H0z" />
            <text x="84" y="90" fontSize="24" textAnchor="middle" fill="currentColor">Ballou</text>
        </svg>
    );

    return (
        <>
            <div className="bg-[var(--brand-blue)] text-[var(--brand-light)] pt-12 pb-0">
                <div className="container mx-auto px-4 max-w-7xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Colonne 1 : Logo + Adresse */}
                        <div className="text-left">
                            {logoBallou ? (
                                <img src={logoBallou} alt="Logo Ballou" className="mb-4 h-12 w-auto" />
                            ) : (
                                <LogoPlaceholder />
                            )}
                            <p className="text-sm leading-relaxed max-w-md">{address}</p>
                        </div>

                        {/* Colonne 2 : Liens utiles + Logo Pro */}
                        <div className="text-left">
                            <h3 className="text-lg font-semibold mb-4">Liens utiles</h3>
                            <ul className="flex flex-col space-y-2 text-sm mb-4">
                                {menuItems.map((item, i) => (
                                    <li key={i}>
                                        <a
                                            href={item.url ?? '#'}
                                            className="block text-[var(--brand-light)] hover:text-[var(--brand-orange)] transition-colors py-1"
                                        >
                                            {item.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            {logoBallouPro && <img src={logoBallouPro} alt="Ballou Pro" className="h-8 w-auto" />}
                        </div>

                        {/* Colonne 3 : Dernières actualités (force visibilité avec min-h) */}
                        <div className="text-left min-h-[300px]">  {/* Augmenté pour image */}
                            <h3 className="text-lg font-semibold mb-4">Dernières actualités</h3>

                            {/* Ternaire corrigé : Condition ? (JSX iframe) : (JSX fallback) – Sans comment inline */}
                            {USE_IFRAME && iframeSrc && !embedError ? (
                                <div className="w-full">
                                    <iframe
                                        title="Facebook Page"
                                        src={iframeSrc}
                                        width="100%"
                                        height={250}
                                        style={{ border: "none", overflow: "hidden" }}
                                        scrolling="no"
                                        frameBorder={0}
                                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                                        allowFullScreen={true}
                                        onError={handleIframeError}
                                    />
                                </div>
                            ) : (
                                <FacebookFallback fbPageUrl={fbPageUrl} fbPageId={fbPageId} />
                            )}

                            {/* XFBML si activé (optionnel, rarement recommandé) */}
                            {USE_XFBML && (
                                <div
                                    ref={fbContainerRef}
                                    className="fb-page"
                                    data-href={fbPageUrl ?? ''}
                                    data-tabs="timeline"
                                    data-width=""
                                    data-height="250"
                                    data-small-header="false"
                                    data-adapt-container-width="true"
                                    data-hide-cover="false"
                                    data-show-facepile="true"
                                >
                                    <blockquote cite={fbPageUrl ?? ''} className="fb-xfbml-parse-ignore">
                                        <a href={fbPageUrl ?? '#'}>Ballou Madagascar</a>
                                    </blockquote>
                                </div>
                            )}

                            {/* Lien toujours visible */}
                            <p className="text-xs text-[var(--brand-light)]/70 mt-2">
                                <a href={fbPageUrl ?? '#'} target="_blank" rel="noopener" className="hover:text-[var(--brand-orange)]">
                                    Voir plus sur Facebook
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Copyright */}
            <div className="bg-[var(--brand-orange)] text-[var(--brand-light)] py-4 border-t border-blue-800/50 mt-0">
                <div className="container mx-auto px-4 max-w-7xl flex justify-between items-center text-sm">
                    <span>© {new Date().getFullYear()} Ballou Madagascar</span>
                    <div className="flex items-center space-x-4">
                        <span className="hidden sm:inline">Suivez-nous :</span>
                        <div className="flex space-x-2">
                            {socialLinks.map((link, i) => (
                                <SocialIcon key={i} url={link.url} title={link.title} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Footer;