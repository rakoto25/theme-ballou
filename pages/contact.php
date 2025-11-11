<?php

/**
 * Template Name: Page Contact Ballou (Hybride SEO + React)
 */
if (!defined('ABSPATH')) exit;

get_header();
ballou_maybe_enqueue_vite();  // Enqueue Vite bundle

// ← FIX : Récup ID numérique CF7 par titre (fallback ACF/option/hardcode)
$form_id = 0;  // Init
if (function_exists('get_field') && class_exists('ACF')) {
    $form_id = (int) get_field('contact_form_id');
}
if (!$form_id) {
    $form_id = (int) get_option('contact_form_id', 0);
}
if (!$form_id) {
    // ← FIX : Fetch ID numérique par titre CF7 (ex: "Formulaire de contact 1")
    global $wpdb;
    $form_id = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts} WHERE post_title = %s AND post_type = 'wpcf7_contact_form' LIMIT 1",
        'Formulaire de contact 1'  // ← Titre exact de votre formulaire
    ));
}
if (!$form_id) {
    $form_id = 1186;  // ← Double fallback : ID numérique réel (de l'URL admin)
    error_log("CF7 Numeric ID Fallback: " . $form_id);  // ← DEBUG
}
error_log("CF7 Numeric ID Used for API: " . $form_id);  // Log en debug.log

// ← FIX : Génère unit tag (format : wpcf7-f{form_id}-p{page_id}-o1)
$page_id = get_the_ID() ?: 0;  // ID page contact (ex: 123) ; fallback 0 si headless
$unit_tag = 'wpcf7-f' . $form_id . '-p' . $page_id . '-o1';
if ($page_id === 0) $unit_tag = 'wpcf7-f' . $form_id . '-o1';  // Fallback sans page ID
error_log("CF7 Unit Tag Generated: " . $unit_tag);  // ← DEBUG en debug.log

$contact_props = [
    'formId' => $form_id,  // ← Numérique pour REST API (ex: 1186)
    'unitTag' => $unit_tag,  // ← Unit tag pour sécurité CF7
    'nonce' => wp_create_nonce('wp_rest'),
    'contactInfo' => [
        'phone'    => '+261 34 17 340 22',
        'email'    => 'contact@ballou.mg',
        'facebook' => 'https://www.facebook.com/ballou.madagascar',
        'address'  => 'Rue Docteur Joseph Raseta, Anosivita Boina, 6e Arrondissement, Madagascar',
        'map'      => ['lat' => -18.880389, 'lng' => 47.50617, 'zoom' => 16],
    ],
];
?>

<main class="container mx-auto px-4 py-10">
    <!-- Header sr-only, section data-island inchangés -->
    <header class="sr-only">
        <h1><?php echo esc_html(get_the_title()); ?></h1>
    </header>

    <section data-island="contact" data-props='<?php echo esc_attr(wp_json_encode($contact_props)); ?>'>
        <div class="island-root"></div>
    </section>

    <noscript>
        <!-- Fallback infos + carte statique inchangés -->
        <div class="max-w-3xl mx-auto space-y-6">
            <h2 class="text-2xl font-bold text-gray-900">Contactez-nous</h2>
            <!-- Grid infos, img OSM, shortcode avec hashed ID pour front-end -->
            <div class="grid md:grid-cols-2 gap-8">
                <!-- Space-y-4 phone/email/etc. inchangés -->
                <div class="space-y-4">
                    <p><strong>Téléphone :</strong> <?php echo esc_html($contact_props['contactInfo']['phone']); ?></p>
                    <p><strong>Email :</strong> <a href="mailto:<?php echo esc_attr($contact_props['contactInfo']['email']); ?>"><?php echo esc_html($contact_props['contactInfo']['email']); ?></a></p>
                    <p><strong>Adresse :</strong> <?php echo esc_html($contact_props['contactInfo']['address']); ?></p>
                    <p><strong>Facebook :</strong> <a href="<?php echo esc_url($contact_props['contactInfo']['facebook']); ?>" target="_blank" rel="noopener">Visitez notre page</a></p>
                </div>
                <div>
                    <?php
                    $map_lat = $contact_props['contactInfo']['map']['lat'];
                    $map_lng = $contact_props['contactInfo']['map']['lng'];
                    ?>
                    <img src="https://www.openstreetmap.org/export/embed.html?bbox=<?php echo ($map_lng - 0.01); ?>,<?php echo ($map_lat - 0.01); ?>,<?php echo ($map_lng + 0.01); ?>,<?php echo ($map_lat + 0.01); ?>&layer=mapnik&marker=<?php echo $map_lat; ?>,<?php echo $map_lng; ?>"
                        alt="Localisation Ballou" class="w-full rounded-lg" style="width:400px;height:300px;" />
                    <p className="text-sm text-gray-500 mt-2">Carte statique (activez JS pour interactive)</p>
                </div>
            </div>
            <?php echo do_shortcode('[contact-form-7 id="016820d" title="Formulaire de contact 1"]'); ?> <!-- Hashed OK pour shortcode -->
        </div>
    </noscript>

    <!-- JSON-LD inchangé -->
    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "<?php echo esc_attr(get_bloginfo('name')); ?>",
            "telephone": "<?php echo esc_attr($contact_props['contactInfo']['phone']); ?>",
            "email": "<?php echo esc_attr($contact_props['contactInfo']['email']); ?>",
            "url": "<?php echo esc_url(home_url('/')); ?>",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "Rue Docteur Joseph Raseta",
                "addressLocality": "Anosivita Boina, 6e Arrondissement",
                "addressCountry": "Madagascar"
            },
            "sameAs": ["<?php echo esc_url($contact_props['contactInfo']['facebook']); ?>"],
            "geo": {
                "@type": "GeoCoordinates",
                "latitude": <?php echo $contact_props['contactInfo']['map']['lat']; ?>,
                "longitude": <?php echo $contact_props['contactInfo']['map']['lng']; ?>
            }
        }
    </script>
</main>

<?php get_footer(); ?>