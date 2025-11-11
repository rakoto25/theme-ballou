<?php
if (!defined('ABSPATH')) exit;


// Canonical par défaut (laisser Yoast/RankMath gérer si installé)
add_action('wp_head', function () {
    if (defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION')) return; // délégué au plugin SEO
    if (is_singular() || is_post_type_archive('product') || is_product_taxonomy()) {
        echo '<link rel="canonical" href="' . esc_url(get_permalink()) . '" />';
    }
}, 1);


// BreadcrumbList minimal (si pas de plugin)
add_action('wp_head', function () {
    if (!function_exists('is_woocommerce')) return;
    if (!is_product() && !is_product_taxonomy()) return;
    $items = [];
    $items[] = ['@type' => 'ListItem', 'position' => 1, 'name' => get_bloginfo('name'), 'item' => home_url('/')];
    if (is_product()) {
        $terms = wc_get_product_terms(get_the_ID(), 'product_cat', ['fields' => 'all']);
        if (!empty($terms)) {
            $cat = array_shift($terms);
            $items[] = ['@type' => 'ListItem', 'position' => 2, 'name' => $cat->name, 'item' => get_term_link($cat)];
        }
        $items[] = ['@type' => 'ListItem', 'position' => count($items) + 1, 'name' => get_the_title(), 'item' => get_permalink()];
    }
    $json = ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items];
    echo '<script type="application/ld+json">' . wp_json_encode($json) . '</script>';
}, 99);
