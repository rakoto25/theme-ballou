import React from 'react';

interface Props {
    title: string;
    siteName: string;
    siteUrl: string;
    contactEmail: string;
    phone: string;
    privacyUrl: string;
    customContent?: string;
}

const Cookies: React.FC<Props> = ({
    title,
    siteName,
    siteUrl,
    contactEmail,
    phone,
    privacyUrl,
    customContent
}) => {
    return (
        <div className="max-w-4xl mx-auto prose prose-gray dark:prose-invert">
            {/* Titre principal */}
            <h1 className="text-3xl font-bold text-gray-900 mb-8 border-b border-orange-200 pb-4" style={{ borderColor: 'var(--brand-accent, #e94e1b)' }}>
                {title}
            </h1>

            {/* Section 1: Introduction */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">1. Introduction</h2>
                <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">
                        Cette politique relative aux cookies décrit comment{' '}
                        <a href={siteUrl} className="text-orange-600 hover:underline" style={{ color: 'var(--brand-accent, #e94e1b)' }}>
                            {siteName}
                        </a>{' '}
                        utilise les cookies et technologies similaires sur son site web. Ces outils nous aident à améliorer votre navigation et à analyser l'utilisation du site.
                    </p>
                    <p className="text-gray-700 leading-relaxed">
                        Nous collectons uniquement les données avec votre consentement explicite, conformément au RGPD et à la loi malgache sur la protection des données. Vous pouvez retirer votre consentement à tout moment via notre outil de gestion des cookies.
                    </p>
                </div>
            </section>

            {/* Section 2: Qu'est-ce qu'un cookie ? */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">2. Qu'est-ce qu'un cookie ?</h2>
                <p className="text-gray-700 leading-relaxed">
                    Un cookie est un petit fichier texte envoyé par un serveur web à votre navigateur internet ou à votre application mobile. Il est stocké sur votre appareil (ordinateur, tablette ou smartphone) et associé à un domaine web spécifique.
                </p>
                <p className="text-gray-700 leading-relaxed">
                    Les cookies ne contiennent pas de virus et ne peuvent pas endommager votre appareil. Ils nous permettent de mémoriser des informations sur vos visites pour personnaliser votre expérience.
                </p>
            </section>

            {/* Section 3: Types de cookies utilisés */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">3. Types de cookies utilisés sur notre site</h2>
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg" style={{ backgroundColor: 'var(--brand-light, #f9fafb)' }}>
                        <h3 className="font-semibold text-gray-900 mb-2">Cookies essentiels (obligatoires)</h3>
                        <p className="text-gray-700 text-sm">Ces cookies sont nécessaires au bon fonctionnement du site. Ils permettent la navigation et l'accès aux fonctionnalités sécurisées. Durée : pendant la session ou 1 an max. Exemples : cookies de session, authentification.</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg" style={{ backgroundColor: 'var(--brand-light, #f9fafb)' }}>
                        <h3 className="font-semibold text-gray-900 mb-2">Cookies analytiques</h3>
                        <p className="text-gray-700 text-sm">Ils nous aident à comprendre comment les utilisateurs interagissent avec le site (ex. : Google Analytics). Données anonymisées. Durée : jusqu'à 2 ans. Vous pouvez vous opposer via les outils Google.</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg" style={{ backgroundColor: 'var(--brand-light, #f9fafb)' }}>
                        <h3 className="font-semibold text-gray-900 mb-2">Cookies fonctionnels</h3>
                        <p className="text-gray-700 text-sm">Pour adapter le site à vos préférences (ex. : langue, panier). Durée : 1 mois. Exemples : mémorisation de la langue choisie.</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg" style={{ backgroundColor: 'var(--brand-light, #f9fafb)' }}>
                        <h3 className="font-semibold text-gray-900 mb-2">Cookies marketing (tiers)</h3>
                        <p className="text-gray-700 text-sm">Pour des publicités personnalisées (ex. : Facebook Pixel, Google Ads). Ils trackent votre comportement sur d'autres sites. Durée : jusqu'à 13 mois. Opt-out via notre bannière ou liens tiers.</p>
                    </div>
                </div>
            </section>

            {/* Section 4: Gestion des cookies */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">4. Comment gérer vos cookies ?</h2>
                <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">
                        Au premier visite, une bannière vous demande votre consentement pour les cookies non essentiels. Vous pouvez :
                    </p>
                    <ul className="text-gray-700 leading-relaxed space-y-1 pl-5 list-disc">
                        <li>Accepter tous les cookies pour une expérience optimale.</li>
                        <li>Refuser les cookies tiers (analytiques et marketing).</li>
                        <li>Personnaliser vos choix par catégorie.</li>
                    </ul>
                    <p className="text-gray-700 leading-relaxed">
                        Pour modifier : Revenez sur la bannière (icône en bas à gauche) ou consultez les paramètres de votre navigateur (ex. : Chrome, Firefox). Pour plus d'infos sur la protection des données, voir notre{' '}
                        <a href={privacyUrl} className="text-orange-600 hover:underline" style={{ color: 'var(--brand-accent, #e94e1b)' }}>
                            politique de confidentialité
                        </a>.
                    </p>
                    <p className="text-gray-700 leading-relaxed">
                        Outils externes pour bloquer les trackers :{' '}
                        <a href="https://www.youronlinechoices.com/fr/vos-choix/" target="_blank" rel="noopener" className="text-orange-600 hover:underline" style={{ color: 'var(--brand-accent, #e94e1b)' }}>
                            Your Online Choices
                        </a>{' '}
                        ou{' '}
                        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener" className="text-orange-600 hover:underline" style={{ color: 'var(--brand-accent, #e94e1b)' }}>
                            Google Analytics Opt-out
                        </a>.
                    </p>
                </div>
            </section>

            {/* Section 5: Contact */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">5. Contact et questions</h2>
                <p className="text-gray-700 leading-relaxed">
                    Si vous avez des questions sur notre politique relative aux cookies, n'hésitez pas à nous contacter par téléphone au{' '}
                    <a href="tel:<?php echo esc_attr(preg_replace('/[^0-9+]/', '', $phone)); ?>" className="text-orange-600 hover:underline" style={{ color: 'var(--brand-accent, #e94e1b)' }}>
                        {phone}
                    </a>{' '}
                    ou par email à{' '}
                    <a href={`mailto:${contactEmail}`} className="text-orange-600 hover:underline" style={{ color: 'var(--brand-accent, #e94e1b)' }}>
                        {contactEmail}
                    </a>.
                </p>
            </section>

            {/* Contenu dynamique ACF si présent */}
            {customContent && (
                <section className="mb-8 bg-gray-50 p-6 rounded-lg" style={{ backgroundColor: 'var(--brand-light, #f9fafb)' }}>
                    <div dangerouslySetInnerHTML={{ __html: customContent }} />
                </section>
            )}

            {/* Footer cookies */}
            <div className="border-t border-gray-300 pt-6 text-center">
                <p className="text-sm text-gray-500">
                    Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}.{' '}
                    {siteName} se réserve le droit de modifier cette politique. Vérifiez régulièrement les mises à jour.
                </p>
            </div>
        </div>
    );
};

export default Cookies;