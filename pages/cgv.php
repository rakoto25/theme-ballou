<?php

/**
 * Template Name: Page Conditions Générales de Vente Ballou (Hybride SEO + React)
 */
if (!defined('ABSPATH')) exit;

get_header();
ballou_maybe_enqueue_vite();  // Enqueue Vite bundle

// Props simples pour le composant React (titre, contenu statique via PHP ou ACF si besoin)
$cgv_props = [
    'title' => get_the_title() ?: 'Conditions Générales de Vente',
    'siteName' => get_bloginfo('name'),
    'siteUrl' => home_url('/'),
    'contactEmail' => 'contact@ballou.mg',  // Exemple ; adaptez via ACF/option si besoin
    'phone' => '+261 34 17 340 22',
];

// Pour du contenu dynamique via ACF (optionnel : si vous avez un champ ACF 'cgv_content' sur la page)
$dynamic_content = '';
if (function_exists('get_field')) {
    $dynamic_content = get_field('cgv_content') ?: '';  // Raw HTML ou texte ; React le rendra
}
if ($dynamic_content) {
    $cgv_props['customContent'] = $dynamic_content;
}
?>

<main class="container mx-auto px-4 py-10">
    <!-- Header sr-only pour SEO -->
    <header class="sr-only">
        <h1><?php echo esc_html($cgv_props['title']); ?></h1>
    </header>

    <section data-island="cgv" data-props='<?php echo esc_attr(wp_json_encode($cgv_props)); ?>'>
        <div class="island-root"></div>
    </section>

    <noscript>
        <!-- Fallback statique pour SEO/accessibilité (contenu CGV basique en PHP) -->
        <div class="max-w-4xl mx-auto prose prose-gray dark:prose-invert">
            <h1 class="text-3xl font-bold text-gray-900 mb-8"><?php echo esc_html($cgv_props['title']); ?></h1>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
                <p class="text-gray-700 leading-relaxed">Les présentes Conditions Générales de Vente (CGV) s'appliquent à toutes les commandes passées sur le site <?php echo esc_html($cgv_props['siteName']); ?> accessible à l'adresse <?php echo esc_url($cgv_props['siteUrl']); ?>. En passant une commande, vous acceptez sans réserve ces CGV.</p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">2. Commande et Paiement</h2>
                <p class="text-gray-700 leading-relaxed">Les commandes sont confirmées par email. Les paiements sont sécurisés via [méthodes : carte, virement, etc.]. En cas de non-paiement, la commande sera annulée.</p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">3. Livraison</h2>
                <p class="text-gray-700 leading-relaxed">Les livraisons sont effectuées à Madagascar. Délais : 3-7 jours. Frais : calculés au panier. Tout dommage lors du transport doit être signalé dans les 48h.</p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">4. Droit de Rétractation</h2>
                <p class="text-gray-700 leading-relaxed">Vous disposez de 14 jours pour exercer votre droit de rétractation. Les produits doivent être retournés dans leur emballage d'origine. Les frais de retour sont à votre charge.</p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">5. Garantie et Service Après-Vente</h2>
                <p class="text-gray-700 leading-relaxed">Garantie légale de 2 ans sur les produits. Contactez-nous pour tout SAV : <?php echo esc_html($cgv_props['phone']); ?> ou <?php echo esc_html($cgv_props['contactEmail']); ?>.</p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">6. Loi Applicable</h2>
                <p class="text-gray-700 leading-relaxed">Ces CGV sont régies par le droit malgache. Tout litige sera soumis aux tribunaux compétents de Madagascar.</p>
            </section>

            <?php if ($dynamic_content): ?>
                <div class="mb-8"><?php echo $dynamic_content; ?></div>
            <?php endif; ?>

            <div class="border-t border-gray-300 pt-6 text-center">
                <p class="text-sm text-gray-500">Dernière mise à jour : <?php echo date('d/m/Y'); ?>. <?php echo esc_html($cgv_props['siteName']); ?> se réserve le droit de modifier ces CGV.</p>
            </div>
        </div>
    </noscript>

    <!-- JSON-LD pour SEO (page légale basique) -->
    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "<?php echo esc_attr($cgv_props['title']); ?>",
            "url": "<?php echo esc_url(get_permalink()); ?>",
            "publisher": {
                "@type": "Organization",
                "name": "<?php echo esc_attr($cgv_props['siteName']); ?>",
                "contactPoint": {
                    "@type": "ContactPoint",
                    "telephone": "<?php echo esc_attr($cgv_props['phone']); ?>",
                    "contactType": "customer service",
                    "email": "<?php echo esc_attr($cgv_props['contactEmail']); ?>"
                }
            },
            "datePublished": "<?php echo get_the_date('c'); ?>"
        }
    </script>
</main>

<?php get_footer(); ?>