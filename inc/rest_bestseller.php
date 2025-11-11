<?php
if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('site-info/v1', '/bestsellers-lite', [
        'methods'  => 'GET',
        'callback' => 'ballou_rest_bestsellers_lite',
        'permission_callback' => '__return_true',
        'args' => [
            'limit' => ['default' => 12],
            'days'  => ['default' => 30],
            'category' => [],
            'include_variations' => ['default' => 0],
        ],
    ]);
});

function ballou_rest_bestsellers_lite(WP_REST_Request $req)
{
    global $wpdb;

    $limit = max(1, intval($req->get_param('limit') ?: 12));
    $days  = max(0, intval($req->get_param('days')  ?: 30)); // 0 = ignore période
    $cat_slug = sanitize_text_field($req->get_param('category') ?: '');
    $include_variations = intval($req->get_param('include_variations') ?: 0) === 1;

    // Filtre catégorie → ids
    $cat_ids = [];
    if ($cat_slug) {
        $term = get_term_by('slug', $cat_slug, 'product_cat');
        if ($term && !is_wp_error($term)) {
            $cat_ids[] = (int) $term->term_id;
        }
        if (empty($cat_ids)) {
            return new WP_REST_Response([], 200);
        }
    }

    // 1) Si days > 0 : calcule via commandes récentes
    $product_counts = [];
    if ($days > 0) {
        $date_from = gmdate('Y-m-d H:i:s', strtotime("-{$days} days"));
        $order_statuses = wc_get_is_paid_statuses();

        $sql = "
            SELECT im2.meta_value AS product_id, SUM(im_qty.meta_value) AS qty_sum
            FROM {$wpdb->posts} AS p
            INNER JOIN {$wpdb->prefix}woocommerce_order_items AS oi ON p.ID = oi.order_id AND oi.order_item_type IN ('line_item')
            INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta AS im1 ON im1.order_item_id = oi.order_item_id AND im1.meta_key = '_product_id'
            LEFT  JOIN {$wpdb->prefix}woocommerce_order_itemmeta AS im2 ON im2.order_item_id = oi.order_item_id AND im2.meta_key = '_variation_id'
            INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta AS im_qty ON im_qty.order_item_id = oi.order_item_id AND im_qty.meta_key = '_qty'
            WHERE p.post_type = 'shop_order'
              AND p.post_status IN (" . implode(',', array_fill(0, count($order_statuses), '%s')) . ")
              AND p.post_date >= %s
            GROUP BY product_id
            ORDER BY qty_sum DESC
            LIMIT %d
        ";

        $params = array_map(fn($s) => 'wc-' . $s, $order_statuses);
        $params[] = $date_from;
        $params[] = $limit;

        $rows = $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A);

        foreach ($rows as $r) {
            $pid = intval($r['product_id']);
            if ($pid <= 0) continue;
            $product_counts[$pid] = intval($r['qty_sum']);
        }

        if (!empty($cat_ids)) {
            foreach (array_keys($product_counts) as $pid) {
                if (!has_term($cat_ids, 'product_cat', $pid)) {
                    unset($product_counts[$pid]);
                }
            }
        }

        arsort($product_counts);
        $product_ids = array_slice(array_keys($product_counts), 0, $limit);
    }

    // 2) Fallback si pas de période (days=0) OU aucune vente trouvée
    if ($days === 0 || empty($product_counts)) {
        $args = [
            'post_type'      => $include_variations ? ['product', 'product_variation'] : 'product',
            'posts_per_page' => $limit,
            'post_status'    => 'publish',
            'meta_key'       => 'total_sales',
            'orderby'        => 'meta_value_num',
            'order'          => 'DESC',
            'fields'         => 'ids',
            'tax_query'      => [],
        ];
        if (!empty($cat_ids)) {
            $args['tax_query'][] = [
                'taxonomy' => 'product_cat',
                'field'    => 'term_id',
                'terms'    => $cat_ids,
                'operator' => 'IN',
            ];
        }
        $q = new WP_Query($args);
        $product_ids = $q->posts;
        wp_reset_postdata();
    }

    // Build réponse
    $out = [];
    foreach ($product_ids as $pid) {
        $product = wc_get_product($pid);
        if (!$product) continue;

        if (!$include_variations && $product->is_type('variation')) {
            $parent_id = $product->get_parent_id();
            $product = $parent_id ? wc_get_product($parent_id) : $product;
        }

        if ('publish' !== get_post_status($product->get_id())) continue;
        if (!$product->is_visible()) continue;

        $img = get_the_post_thumbnail_url($product->get_id(), 'medium');
        if (!$img) $img = wc_placeholder_img_src('medium');

        $out[] = [
            'id'        => $product->get_id(),
            'slug'      => $product->get_slug(),
            'title'     => $product->get_name(),
            'price'     => (float) $product->get_price(),
            'currency'  => get_woocommerce_currency(),
            'sku'       => $product->get_sku(),              // ← ← ICI : on expose bien le SKU
            'image'     => $img,
            'permalink' => get_permalink($product->get_id()),
        ];
    }

    return new WP_REST_Response($out, 200);
}
