<?php
function extend_woocommerce_search_sku_desc($search, $wp_query)
{
    global $wpdb;

    if (! $wp_query->is_main_query() || ! is_search() || ! class_exists('WooCommerce')) {
        return $search;
    }

    $search_term = $wp_query->get('s'); // ?s=term
    if (empty($search_term)) {
        return $search;
    }

    // Query existante + SKU (meta _sku LIKE) + description (post_excerpt/post_content)
    $search = " AND (
        {$wpdb->posts}.post_title LIKE '%" . esc_sql($search_term) . "%'
        OR {$wpdb->posts}.post_excerpt LIKE '%" . esc_sql($search_term) . "%'
        OR {$wpdb->posts}.post_content LIKE '%" . esc_sql($search_term) . "%'
        OR EXISTS (
            SELECT 1 FROM {$wpdb->postmeta}
            WHERE {$wpdb->postmeta}.meta_key = '_sku'
            AND {$wpdb->postmeta}.meta_value LIKE '%" . esc_sql($search_term) . "%'
            AND {$wpdb->postmeta}.post_id = {$wpdb->posts}.ID
        )
    )";

    return $search;
}
add_filter('posts_search', 'extend_woocommerce_search_sku_desc', 10, 2);

// Optionnel : Limite post_type=product pour search pure
function limit_search_to_products($query)
{
    if (! is_admin() && $query->is_main_query() && is_search()) {
        $query->set('post_type', 'product');
    }
}
add_action('pre_get_posts', 'limit_search_to_products');

// Pour REST API (fetchProducts/live) : Étend search param (si lib/produits utilise WP_Query interne)
function extend_rest_products_search($args, $request)
{
    if (isset($request['search'])) {
        $search_term = $request['search'];
        $args['meta_query'][] = array(
            'key'     => '_sku',
            'value'   => $search_term,
            'compare' => 'LIKE'
        );
        $args['s'] = $search_term; // + titre/desc
    }
    return $args;
}
add_filter('woocommerce_rest_products_query', 'extend_rest_products_search', 10, 2);
