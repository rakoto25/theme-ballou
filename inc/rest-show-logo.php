<?php
// inc/rest-show-logo.php
if (!defined('ABSPATH')) exit;

/**
 * Récupère l'URL du logo du site (image brute), pas du HTML.
 * Priorité :
 *   1) Logo personnalisé (custom_logo)
 *   2) Icône du site (site icon)
 *   3) Fallback: null
 */
function ballou_get_logo_url(int $size = 512): ?string
{
    // 1) Logo personnalisé (Theme Customizer)
    $custom_logo_id = (int) get_theme_mod('custom_logo');
    if ($custom_logo_id > 0) {
        // Essaye d’obtenir une taille adaptée; 'full' si pas de taille
        $url = wp_get_attachment_image_url($custom_logo_id, 'full');
        if ($url) return $url;
    }

    // 2) Icône du site (favicon/app icon)
    $icon = get_site_icon_url($size);
    if (!empty($icon)) return $icon;

    // 3) Pas de logo trouvable
    return null;
}

/**
 * Callback REST: /site-logo
 * GET params:
 *   - size (int, optionnel) : taille suggérée pour l’icône (fallback), défaut 512
 */
function ballou_rest_get_site_logo(WP_REST_Request $req)
{
    $size = (int) ($req->get_param('size') ?: 512);
    if ($size < 64) $size = 64;
    if ($size > 2048) $size = 2048;

    $logo_url = ballou_get_logo_url($size);

    // Réponse uniforme
    $data = [
        'logo_url'  => $logo_url,
        'site_name' => get_bloginfo('name'),
        'size'      => $size,
    ];

    // 200 même si null : le front peut gérer un fallback local si besoin
    return new WP_REST_Response($data, 200);
}

/**
 * Enregistre la route sous 2 namespaces:
 * - /wp-json/site-info/v1/site-logo
 * - /wp-json/ballou/v1/site-logo
 */
add_action('rest_api_init', function () {
    $args = [
        'methods'             => 'GET',
        'callback'            => 'ballou_rest_get_site_logo',
        'permission_callback' => '__return_true',
        'args' => [
            'size' => [
                'description' => 'Dimension (suggestion) pour le fallback icône du site.',
                'type'        => 'integer',
                'required'    => false,
                'default'     => 512,
            ],
        ],
    ];

    register_rest_route('site-info/v1', '/site-logo', $args);
    register_rest_route('ballou/v1',    '/site-logo', $args);
});
