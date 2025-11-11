<?php
// inc/rest_products.php
if (!defined('ABSPATH')) exit;

/**
 * Enregistre la route produits sous 2 namespaces :
 * - /wp-json/site-info/v1/products
 * - /wp-json/ballou/v1/products
 */
add_action('rest_api_init', function () {
    if (!function_exists('register_rest_route')) return;

    $route_args = [
        'methods'             => 'GET',
        'callback'            => 'ballou_rest_products',
        'permission_callback' => '__return_true',
        'args' => [
            'search'     => [
                'description' => 'Recherche plein texte (titre) et SKU (fuzzy).',
                'type'        => 'string',
                'required'    => false,
            ],
            'categories' => [
                'description' => 'CSV de slugs catégorie (ex: "lit,canapes").',
                'type'        => 'string',
                'required'    => false,
            ],
            'min_price'  => [
                'description' => 'Prix min.',
                'type'        => 'number',
                'required'    => false,
                'default'     => 0,
            ],
            'max_price'  => [
                'description' => 'Prix max.',
                'type'        => 'number',
                'required'    => false,
            ],
            'date_from'  => [
                'description' => 'Filtre date (YYYY-MM-DD) inclusif (après).',
                'type'        => 'string',
                'required'    => false,
            ],
            'date_to'    => [
                'description' => 'Filtre date (YYYY-MM-DD) inclusif (avant).',
                'type'        => 'string',
                'required'    => false,
            ],
            'page'       => [
                'description' => 'Page (1..n).',
                'type'        => 'integer',
                'required'    => false,
                'default'     => 1,
            ],
            'per_page'   => [
                'description' => 'Résultats par page (1..48).',
                'type'        => 'integer',
                'required'    => false,
                'default'     => 16,
            ],
            'orderby'    => [
                'description' => 'Tri: date|title|price|popularity.',
                'type'        => 'string',
                'required'    => false,
                'default'     => 'date',
                'enum'        => ['date', 'title', 'price', 'popularity'],
            ],
            'order'      => [
                'description' => 'Ordre: ASC|DESC.',
                'type'        => 'string',
                'required'    => false,
                'default'     => 'DESC',
                'enum'        => ['ASC', 'DESC'],
            ],
            'min_stock'  => [
                'description' => 'Stock minimal effectif (0=inclure ruptures).',
                'type'        => 'integer',
                'required'    => false,
                'default'     => 1,
            ],
        ],
    ];

    // Namespace original
    register_rest_route('site-info/v1', '/products', $route_args);
    // Alias "ballou" pour éviter les 404 si le front l’utilise
    register_rest_route('ballou/v1', '/products', $route_args);
});

/**
 * Stock effectif d’un produit :
 * - variable : max des stocks variations gérées (ou 1 si au moins une variation est in_stock sans gestion)
 * - simple   : quantité réelle si gestion, sinon 1 si in_stock, sinon 0
 */
function ballou_effective_stock(WC_Product $p): int
{
    if ($p->is_type('variable')) {
        $children = $p->get_children();
        $best = 0;
        foreach ($children as $vid) {
            $v = wc_get_product($vid);
            if (!$v || !($v instanceof WC_Product_Variation)) continue;

            if ($v->managing_stock()) {
                $q = (int) $v->get_stock_quantity();
                if ($q > $best) $best = $q;
            } else {
                if ($v->is_in_stock() && $best < 1) $best = 1;
            }
        }
        return max(0, $best);
    }

    if ($p->managing_stock()) {
        return max(0, (int) $p->get_stock_quantity());
    }
    return $p->is_in_stock() ? 1 : 0;
}

function ballou_rest_products(WP_REST_Request $req)
{
    if (!class_exists('WooCommerce')) {
        return new WP_REST_Response(['error' => 'WooCommerce manquant'], 500);
    }

    $page       = max(1, (int) ($req->get_param('page') ?: 1));
    $per_page   = max(1, min(48, (int) ($req->get_param('per_page') ?: 16)));
    $search     = sanitize_text_field($req->get_param('search') ?: '');
    $cat_csv    = sanitize_text_field($req->get_param('categories') ?: '');
    $min_price  = max(0, (float) ($req->get_param('min_price') ?: 0));
    $max_price  = ($req->get_param('max_price') !== null && $req->get_param('max_price') !== '') ? (float) $req->get_param('max_price') : null;
    $date_from  = sanitize_text_field($req->get_param('date_from') ?: '');
    $date_to    = sanitize_text_field($req->get_param('date_to') ?: '');
    $orderby    = sanitize_text_field($req->get_param('orderby') ?: 'date');
    $order      = strtoupper(sanitize_text_field($req->get_param('order') ?: 'DESC'));
    $min_stock  = max(0, (int) ($req->get_param('min_stock') ?? 1));

    // --- Catégories (CSV de slugs) -> term_ids
    $tax_query = [];
    if ($cat_csv) {
        $slugs = array_filter(array_map('trim', explode(',', $cat_csv)));
        if (!empty($slugs)) {
            $terms = get_terms([
                'taxonomy'   => 'product_cat',
                'slug'       => $slugs,
                'hide_empty' => false,
                'fields'     => 'ids',
            ]);
            if (!is_wp_error($terms) && !empty($terms)) {
                $tax_query[] = [
                    'taxonomy' => 'product_cat',
                    'field'    => 'term_id',
                    'terms'    => $terms,
                    'operator' => 'IN',
                ];
            }
        }
    }

    // --- Prix + stock
    $meta_query = [
        'relation' => 'AND',
        [
            'key'     => '_stock_status',
            'value'   => 'instock',
            'compare' => '=',
        ],
    ];

    if ($min_price > 0 || $max_price !== null) {
        if ($max_price !== null) {
            $meta_query[] = [
                'key'     => '_price',
                'value'   => [$min_price, $max_price],
                'type'    => 'DECIMAL',
                'compare' => 'BETWEEN',
            ];
        } else {
            $meta_query[] = [
                'key'     => '_price',
                'value'   => $min_price,
                'type'    => 'DECIMAL',
                'compare' => '>=',
            ];
        }
    }

    // --- Date
    $date_query = [];
    if ($date_from) $date_query['after']  = $date_from . ' 00:00:00';
    if ($date_to)   $date_query['before'] = $date_to   . ' 23:59:59';
    if (!empty($date_query)) $date_query['inclusive'] = true;

    // --- Recherche : titre OU SKU fuzzy
    $s = $search;
    $sku_ids = [];
    if ($s) {
        $sku_q = new WP_Query([
            'post_type'      => ['product', 'product_variation'],
            'post_status'    => 'publish',
            'posts_per_page' => 200,
            'fields'         => 'ids',
            'meta_query'     => [[
                'key'     => '_sku',
                'value'   => $s,
                'compare' => 'LIKE',
            ]],
        ]);
        $sku_ids = $sku_q->posts;
        wp_reset_postdata();
    }

    // --- Tri
    $query_orderby = 'date';
    $query_meta_key = '';
    if ($orderby === 'title') {
        $query_orderby = 'title';
    } elseif ($orderby === 'price') {
        $query_orderby = 'meta_value_num';
        $query_meta_key = '_price';
    } elseif ($orderby === 'popularity') {
        $query_orderby = 'meta_value_num';
        $query_meta_key = 'total_sales';
    }

    $args = [
        'post_type'           => 'product',
        'post_status'         => 'publish',
        'posts_per_page'      => $per_page,
        'paged'               => $page,
        'orderby'             => $query_orderby,
        'order'               => in_array($order, ['ASC', 'DESC'], true) ? $order : 'DESC',
        'tax_query'           => !empty($tax_query) ? $tax_query : [],
        'meta_query'          => $meta_query,
        'date_query'          => !empty($date_query) ? [$date_query] : [],
        'ignore_sticky_posts' => true,
        'no_found_rows'       => false,
        'fields'              => 'ids',
    ];

    if (!empty($query_meta_key)) {
        $args['meta_key'] = $query_meta_key;
    }

    if ($s) {
        // Si on a trouvé des SKU, on les privilégie
        if (!empty($sku_ids)) {
            $args['post__in'] = $sku_ids;
        } else {
            $args['s'] = $s; // recherche titre
        }
    }

    $q   = new WP_Query($args);
    $ids = $q->posts;

    // --- Min/Max prix globaux (cohérent avec le filtre stock instock)
    $min_q = new WP_Query([
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => 1,
        'orderby'        => 'meta_value_num',
        'meta_key'       => '_price',
        'order'          => 'ASC',
        'fields'         => 'ids',
        'meta_query'     => [[
            'key'     => '_stock_status',
            'value'   => 'instock',
            'compare' => '=',
        ]],
    ]);
    $max_q = new WP_Query([
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => 1,
        'orderby'        => 'meta_value_num',
        'meta_key'       => '_price',
        'order'          => 'DESC',
        'fields'         => 'ids',
        'meta_query'     => [[
            'key'     => '_stock_status',
            'value'   => 'instock',
            'compare' => '=',
        ]],
    ]);
    $min_id = $min_q->have_posts() ? (int) $min_q->posts[0] : 0;
    $max_id = $max_q->have_posts() ? (int) $max_q->posts[0] : 0;
    wp_reset_postdata();

    $min_val = $min_id ? (float) get_post_meta($min_id, '_price', true) : 0;
    $max_val = $max_id ? (float) get_post_meta($max_id, '_price', true) : 0;

    // --- Catégories parent (facettes simples)
    $cat_terms = get_terms([
        'taxonomy'   => 'product_cat',
        'hide_empty' => true,
        'parent'     => 0,
        'number'     => 50,
        'orderby'    => 'name',
        'order'      => 'ASC',
    ]);
    $categories = [];
    if (!is_wp_error($cat_terms)) {
        foreach ($cat_terms as $t) {
            $slug = isset($t->slug) ? strtolower($t->slug) : '';
            $name = isset($t->name) ? $t->name : '';
            if ($slug === 'uncategorized' || stripos($name, 'non class') !== false) continue;
            $categories[] = ['slug' => $slug, 'name' => $name];
        }
    }

    // --- Construction de la liste + filtre strict min_stock
    $items = [];
    foreach ($ids as $pid) {
        $p = wc_get_product($pid);
        if (!$p) continue;
        if (get_post_status($pid) !== 'publish' || !$p->is_visible()) continue;

        $stock = ballou_effective_stock($p);
        if ($stock < $min_stock) continue;

        $img = get_the_post_thumbnail_url($pid, 'medium');
        if (!$img) {
            if (function_exists('wc_placeholder_img_src')) {
                $img = wc_placeholder_img_src('medium');
            } else {
                $img = '';
            }
        }

        $terms = get_the_terms($pid, 'product_cat');
        $cat_name = '';
        if ($terms && !is_wp_error($terms)) {
            foreach ($terms as $t) {
                if ((int) $t->parent === 0) {
                    $cat_name = $t->name;
                    break;
                }
            }
            if ($cat_name === '' && !empty($terms)) $cat_name = $terms[0]->name;
        }

        $items[] = [
            'id'         => (int) $pid,
            'slug'       => $p->get_slug(),
            'title'      => $p->get_name(),
            'price'      => (float) $p->get_price(),
            'currency'   => get_woocommerce_currency(),
            'ref'        => (string) $p->get_sku(),
            'image'      => $img,
            'permalink'  => get_permalink($pid),
            'category'   => $cat_name,
            'created_at' => get_post_time('c', true, $pid),
            // utile pour le front si besoin
            'stock'      => $stock,
        ];
    }

    // ⚠ total/total_pages = ceux de la requête WP_Query (AVANT filtre min_stock)
    // Si tu préfères les totaux post-filtrage, décommente ci-dessous :
    // $total = count($items);
    // $total_pages = (int) ceil($total / max(1, $per_page));
    $total       = (int) $q->found_posts;
    $total_pages = (int) $q->max_num_pages;

    return new WP_REST_Response([
        'items'        => array_values($items),
        'total'        => $total,
        'total_pages'  => $total_pages,
        'min_price'    => (float) $min_val,
        'max_price'    => (float) $max_val,
        'categories'   => $categories,
        'currency'     => get_woocommerce_currency(),
    ], 200);
}
