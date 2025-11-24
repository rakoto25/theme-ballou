<?php

/**
 * Template Name: Page Politique relative aux Cookies Ballou (Hybride SEO + React)
 */
if (!defined('ABSPATH')) exit;

get_header();
ballou_maybe_enqueue_vite();  // Enqueue Vite bundle

// Props simples pour le composant React (titre, infos site, mentions légales)
$cookies_props = [
    'title' => get_the_title() ?: 'Politique relative aux Cookies',
    'siteName' => get_bloginfo('name'),
    'siteUrl' => home_url('/'),
    'contactEmail' => 'contact@ballou.mg',  // Exemple ; adaptez via ACF/option si besoin
    'phone' => '+261 34 17 340 22',
    'privacyUrl' => home_url('/politique-de-confidentialite/'),  // Lien vers page privacy si existe
];

// Pour du contenu dynamique via ACF (optionnel : si vous avez un champ ACF 'cookies_content' sur la page)
$dynamic_content = '';
if (function_exists('get_field')) {
    $dynamic_content = get_field('cookies_content') ?: '';  // Raw HTML ou texte ; React le rendra
}
if ($dynamic_content) {
    $cookies_props['customContent'] = $dynamic_content;
}
?>

<main class="container mx-auto px-4 py-10">
    <!-- Header sr-only pour SEO -->
    <header class="sr-only">
        <h1><?php echo esc_html($cookies_props['title']); ?></h1>
    </header>

    <section data-island="cookies" data-props='<?php echo esc_attr(wp_json_encode($cookies_props)); ?>'>
        <div class="island-root"></div>
    </section>

    <noscript>
        <!-- Fallback statique pour SEO/accessibilité (contenu cookies basique en PHP) -->
        <div class="max-w-4xl mx-auto prose prose-gray dark:prose-invert">
            <h1 class="text-3xl font-bold text-gray-900 mb-8"><?php echo esc_html($cookies_props['title']); ?></h1>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
                <p class="text-gray-700 leading-relaxed">Cette politique explique comment <?php echo esc_html($cookies_props['siteName']); ?> utilise les cookies sur son site <?php echo esc_url($cookies_props['siteUrl']); ?>. Les cookies sont des petits fichiers stockés sur votre appareil pour améliorer l'expérience utilisateur.</p>
                <p class="text-gray-700 leading-relaxed">Nous respectons votre vie privée et obtenons votre consentement pour les cookies non essentiels.</p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">2. Qu'est-ce qu'un cookie ?</h2>
                <p class="text-gray-700 leading-relaxed">Un cookie est un fichier texte envoyé par un serveur web à votre navigateur, qui l'associe à un site web. Il sert à stocker des informations sur les préférences utilisateur.</p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">3. Types de cookies utilisés</h2>
                <ul class="text-gray-700 leading-relaxed space-y-2">
                    <li><strong>Cookies essentiels :</strong> Nécessaires au fonctionnement du site (ex. : session, sécurité). Durée : session.</li>
                    <li><strong>Cookies analytiques :</strong> Pour analyser le trafic (ex. : Google Analytics). Durée : 1 an max. Opt-out possible.</li>
                    <li><strong>Cookies fonctionnels :</strong> Pour mémoriser vos choix (ex. : langue). Durée : 1 mois.</li>
                    <li><strong>Cookies marketing :</strong> Pour du ciblage publicitaire (ex. : Facebook Pixel). Opt-out via consentement.</li>
                </ul>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">4. Gestion des cookies</h2>
                <p class="text-gray-700 leading-relaxed">Vous pouvez gérer les cookies via notre bannière de consentement ou les paramètres de votre navigateur. Pour en savoir plus, consultez notre <a href="<?php echo esc_url($cookies_props['privacyUrl']); ?>">politique de confidentialité</a>.</p>
                <p class="text-gray-700 leading-relaxed">Pour refuser les cookies tiers : <a href="https://www.google.com/settings/ads/" target="_blank" rel="noopener">Google Ads</a> ou <a href="https://www.facebook.com/help/" target="_blank" rel="noopener">Facebook</a>.</p>
            </section>

            <section class="mb-8">
                <h2 class="text-2xl font-semibold text-gray-900 mb-4">5. Contact</h2>
                <p class="text-gray-700 leading-relaxed">Pour toute question sur les cookies, contactez-nous : <?php echo esc_html($cookies_props['phone']); ?> ou <?php echo esc_html($cookies_props['contactEmail']); ?>.</p>
            </section>

            <?php if ($dynamic_content): ?>
                <div class="mb-8"><?php echo $dynamic_content; ?></div>
            <?php endif; ?>

            <div class="border-t border-gray-300 pt-6 text-center">
                <p class="text-sm text-gray-500">Dernière mise à jour : <?php echo date('d/m/Y'); ?>. <?php echo esc_html($cookies_props['siteName']); ?> peut modifier cette politique.</p>
            </div>
        </div>
    </noscript>

    <!-- JSON-LD pour SEO (page légale basique) -->
    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "<?php echo esc_attr($cookies_props['title']); ?>",
            "url": "<?php echo esc_url(get_permalink()); ?>",
            "description": "Politique relative aux cookies du site <?php echo esc_attr($cookies_props['siteName']); ?>",
            "publisher": {
                "@type": "Organization",
                "name": "<?php echo esc_attr($cookies_props['siteName']); ?>",
                "contactPoint": {
                    "@type": "ContactPoint",
                    "telephone": "<?php echo esc_attr($cookies_props['phone']); ?>",
                    "contactType": "customer service",
                    "email": "<?php echo esc_attr($cookies_props['contactEmail']); ?>"
                }
            },
            "datePublished": "<?php echo get_the_date('c'); ?>"
        }
    </script>
</main>

<?php get_footer(); ?>