import React from 'react';

interface Props {
    title: string;
    siteName: string;
    siteUrl: string;
    contactEmail: string;
    phone: string;
    customContent?: string;
}

const CGV: React.FC<Props> = ({
    title,
    siteName,
    siteUrl,
    contactEmail,
    phone,
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
                <p className="text-gray-700 leading-relaxed">
                    Les présentes Conditions Générales de Vente (CGV) s'appliquent à toutes les commandes passées sur le site{' '}
                    <a href={siteUrl} className="text-orange-600 hover:underline" style={{ color: 'var(--brand-accent, #e94e1b)' }}>
                        {siteName}
                    </a>
                    . En passant une commande, vous acceptez sans réserve ces CGV.
                </p>
            </section>

            {/* Section 2: Commande et Paiement */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">2. Commande et Paiement</h2>
                <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">Les commandes sont confirmées par email dans les 24h suivant la validation.</p>
                    <p className="text-gray-700 leading-relaxed">Les paiements sont sécurisés via nos partenaires (carte bancaire, virement bancaire, PayPal). En cas de non-paiement dans les 7 jours, la commande sera annulée automatiquement.</p>
                    <p className="text-gray-700 leading-relaxed">Tous les prix sont en Ariary (MGA) et incluent la TVA applicable à Madagascar.</p>
                </div>
            </section>

            {/* Section 3: Livraison */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">3. Livraison</h2>
                <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">Les livraisons sont effectuées sur le territoire malgache via nos partenaires logistiques (ex. : Poste Malgache, transporteurs locaux).</p>
                    <p className="text-gray-700 leading-relaxed">Délais estimés : 3 à 7 jours ouvrables selon la destination. Les frais de livraison sont calculés au moment du règlement et affichés au panier.</p>
                    <p className="text-gray-700 leading-relaxed">En cas de dommage lors du transport, signalez-le dans les 48 heures à l'adresse {contactEmail} pour un remboursement ou un remplacement.</p>
                </div>
            </section>

            {/* Section 4: Droit de Rétractation */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">4. Droit de Rétractation</h2>
                <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">Conformément à la législation malgache et européenne (si applicable), vous disposez d'un délai de 14 jours à compter de la réception pour exercer votre droit de rétractation sans justification.</p>
                    <p className="text-gray-700 leading-relaxed">Les produits doivent être retournés dans leur état d'origine, emballage intact, aux frais de l'acheteur. Le remboursement (hors frais de livraison) interviendra dans les 14 jours suivant la réception des produits.</p>
                    <p className="text-gray-700 leading-relaxed">Produits sur mesure ou personnalisés ne sont pas éligibles au retour.</p>
                </div>
            </section>

            {/* Section 5: Garantie et SAV */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">5. Garantie et Service Après-Vente</h2>
                <div className="space-y-3">
                    <p className="text-gray-700 leading-relaxed">Tous nos produits bénéficient d'une garantie légale de conformité de 2 ans contre les vices cachés.</p>
                    <p className="text-gray-700 leading-relaxed">Pour tout SAV, contactez-nous par téléphone au {phone} ou par email à {contactEmail}. Fournissez votre numéro de commande et une description du problème.</p>
                    <p className="text-gray-700 leading-relaxed">Les réparations ou remplacements sont effectués dans les meilleurs délais, sous réserve d'examen.</p>
                </div>
            </section>

            {/* Section 6: Loi Applicable */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold text-primary mb-4">6. Loi Applicable et Litiges</h2>
                <p className="text-gray-700 leading-relaxed">Ces CGV sont régies par le droit de la République de Madagascar. Tout litige découlant de ces conditions sera soumis à la compétence exclusive des tribunaux d'Antananarivo.</p>
                <p className="text-gray-700 leading-relaxed">En cas de question, n'hésitez pas à nous contacter pour plus de détails.</p>
            </section>

            {/* Contenu dynamique ACF si présent */}
            {customContent && (
                <section className="mb-8 bg-gray-50 p-6 rounded-lg" style={{ backgroundColor: 'var(--brand-light, #f9fafb)' }}>
                    <div dangerouslySetInnerHTML={{ __html: customContent }} />
                </section>
            )}

            {/* Footer CGV */}
            <div className="border-t border-gray-300 pt-6 text-center">
                <p className="text-sm text-gray-500">
                    Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}.{' '}
                    {siteName} se réserve le droit de modifier ces CGV à tout moment. La version en vigueur est celle affichée sur le site.
                </p>
            </div>
        </div>
    );
};

export default CGV;