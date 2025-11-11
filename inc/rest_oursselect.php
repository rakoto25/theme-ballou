<?php
if (!defined('ABSPATH')) exit;

/**
 * Endpoint: /wp-json/site-info/v1/oursselect
 * Logique: retourne des produits taggés `product_tag` = selection-du-mois (param `tag`),
 * optionnellement filtrés par catégorie (param `category`: slug).
 * Fallback: si aucun produit pour le tag, on retourne des "featured" WooCommerce,
 * sinon des récents publiés.
 * 
 * AJOUT: Filtre meta_query sur _price > 0 pour n'inclure que les produits avec prix réel (évite 0 Ar et placeholders).
 */
add_action('rest_api_init', function () {
    register_rest_route('site-info/v1', '/oursselect', [
        'methods'  => 'GET',
        'callback' => 'ballou_rest_oursselect',
        'permission_callback' => '__return_true',
        'args' => [
            'limit'    => ['default' => 12],
            'tag'      => ['default' => 'selection-du-mois'], // product_tag slug
            'category' => [], // product_cat slug (optionnel)
        ],
    ]);
});

function ballou_rest_oursselect(WP_REST_Request $req)
{
    $limit    = max(1, intval($req->get_param('limit') ?: 12));
    $tag_slug = sanitize_text_field($req->get_param('tag') ?: 'selection-du-mois');
    $cat_slug = sanitize_text_field($req->get_param('category') ?: '');

    $tax_query = ['relation' => 'AND'];

    // Filtre catégorie (optionnel)
    if (!empty($cat_slug)) {
        $tax_query[] = [
            'taxonomy' => 'product_cat',
            'field'    => 'slug',
            'terms'    => [$cat_slug],
            'operator' => 'IN',
        ];
    }

    // Meta query pour prix > 0 (produits réels, pas gratuits ou mal configurés)
    $price_meta = [
        'key'     => '_price',
        'value'   => 0,
        'compare' => '>',
        'type'    => 'NUMERIC'
    ];

    // 1) Essaye avec product_tag = selection-du-mois (ou autre tag fourni)
    $query_args = [
        'post_type'      => 'product',
        'posts_per_page' => $limit,
        'post_status'    => 'publish',
        'fields'         => 'ids',
        'tax_query'      => $tax_query,
        'meta_query'     => ['relation' => 'AND', $price_meta], // ⬅️ Filtre prix > 0
        'orderby'        => 'date',
        'order'          => 'DESC',
    ];

    if (!empty($tag_slug)) {
        $query_args['tax_query'][] = [
            'taxonomy' => 'product_tag',
            'field'    => 'slug',
            'terms'    => [$tag_slug],
            'operator' => 'IN',
        ];
    }

    $q = new WP_Query($query_args);
    $ids = $q->posts;
    wp_reset_postdata();

    // 2) Fallback: si rien avec le tag -> produits "featured"
    if (empty($ids)) {
        $featured_ids = wc_get_featured_product_ids();
        if (!empty($featured_ids)) {
            // Filtre par prix > 0 pour featured
            $featured_ids = array_filter($featured_ids, function ($pid) {
                $price = get_post_meta($pid, '_price', true);
                return is_numeric($price) && (float) $price > 0;
            });
            // Filtre par catégorie si demandée
            if (!empty($cat_slug)) {
                $featured_ids = array_filter($featured_ids, function ($pid) use ($cat_slug) {
                    return has_term($cat_slug, 'product_cat', $pid);
                });
            }
            $ids = array_slice(array_values($featured_ids), 0, $limit);
        }
    }

    // 3) Fallback final: produits publiés récents avec prix > 0
    if (empty($ids)) {
        $q2 = new WP_Query([
            'post_type'      => 'product',
            'posts_per_page' => $limit,
            'post_status'    => 'publish',
            'fields'         => 'ids',
            'orderby'        => 'date',
            'order'          => 'DESC',
            'tax_query'      => $tax_query,
            'meta_query'     => ['relation' => 'AND', $price_meta], // ⬅️ Filtre prix > 0
        ]);
        $ids = $q2->posts;
        wp_reset_postdata();
    }

    // Si toujours vide, log pour debug (optionnel, retire en prod)
    if (empty($ids)) {
        error_log("[OursSelect API] Aucune produit avec prix >0 trouvé. Vérifiez votre catalogue WooCommerce.");
    }

    // Build réponse (seulement produits valides)
    $out = [];
    foreach ($ids as $pid) {
        $product = wc_get_product($pid);
        if (!$product) continue;

        if ('publish' !== get_post_status($product->get_id())) continue;
        if (!$product->is_visible()) continue;

        // Double-check prix >0 avant inclusion
        $price = (float) $product->get_price();
        if ($price <= 0) continue; // Sécurité supplémentaire

        $img = get_the_post_thumbnail_url($product->get_id(), 'medium');
        if (!$img) $img = wc_placeholder_img_src('medium');

        $out[] = [
            'id'        => $product->get_id(),
            'slug'      => $product->get_slug(),
            'title'     => $product->get_name(), // Devrait être le vrai nom si DB OK
            'price'     => $price,
            'currency'  => get_woocommerce_currency(), // "MGA"
            'sku'       => $product->get_sku(),
            'image'     => $img,
            'permalink' => get_permalink($product->get_id()),
        ];
    }

    // Si out vide après tout, retourne message debug (optionnel)
    if (empty($out)) {
        return new WP_REST_Response(['error' => 'Aucun produit valide (avec prix >0) trouvé.'], 200);
    }

    return new WP_REST_Response($out, 200);
}
