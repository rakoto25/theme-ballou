<?php
if (!defined('ABSPATH')) exit;

/**
 * Endpoint: /wp-json/site-info/v1/bestcategories
 * Retourne des catégories parentes (product_cat) sous forme : id, slug, name, count, permalink
 * - Exclut "uncategorized" / "non-classe"
 * - Limite par défaut : 10
 * - Tri : name|count|slug (ASC/DESC)
 */
add_action('rest_api_init', function () {
    register_rest_route('site-info/v1', '/bestcategories', [
        'methods'  => 'GET',
        'callback' => 'ballou_rest_bestcategories',
        'permission_callback' => '__return_true',
        'args' => [
            'limit'  => ['default' => 10],
            'orderby' => ['default' => 'name'],
            'order'  => ['default' => 'ASC'],
        ],
    ]);
});

function ballou_rest_bestcategories(WP_REST_Request $req)
{
    $limit   = max(1, intval($req->get_param('limit') ?: 10));
    $orderby = sanitize_key($req->get_param('orderby') ?: 'name'); // name|count|slug
    $order   = strtoupper($req->get_param('order') ?: 'ASC') === 'DESC' ? 'DESC' : 'ASC';

    // get_terms ne supporte pas directement orderby=count pour les terms,
    // on va trier manuellement en PHP si count demandé.
    $terms = get_terms([
        'taxonomy'   => 'product_cat',
        'hide_empty' => false,   // pour garantir >= 10 résultats
        'parent'     => 0,
        'number'     => 0,       // on filtre après
        'orderby'    => 'name',  // tri initial par nom
        'order'      => 'ASC',
    ]);

    if (is_wp_error($terms) || empty($terms)) {
        return new WP_REST_Response([], 200);
    }

    // Filtrer "uncategorized" / "non-classe"
    $terms = array_values(array_filter($terms, function ($t) {
        $slug = isset($t->slug) ? strtolower($t->slug) : '';
        $name = isset($t->name) ? strtolower($t->name) : '';
        if ($slug === 'uncategorized' || $slug === 'non-classe') return false;
        if (strpos($name, 'non class') !== false) return false;
        return true;
    }));

    // Tri demandé
    if ($orderby === 'count') {
        usort($terms, function ($a, $b) use ($order) {
            $res = intval($a->count) <=> intval($b->count);
            return ($order === 'ASC') ? $res : -$res;
        });
    } elseif ($orderby === 'slug') {
        usort($terms, function ($a, $b) use ($order) {
            $res = strcasecmp($a->slug, $b->slug);
            return ($order === 'ASC') ? $res : -$res;
        });
    } else { // name (A→Z par défaut)
        // Collator FR pour accents
        if (class_exists('Collator')) {
            $coll = new Collator('fr_FR');
            usort($terms, function ($a, $b) use ($order, $coll) {
                $res = $coll->compare($a->name, $b->name);
                return ($order === 'ASC') ? $res : -$res;
            });
        } else {
            usort($terms, function ($a, $b) use ($order) {
                $res = strcasecmp($a->name, $b->name);
                return ($order === 'ASC') ? $res : -$res;
            });
        }
    }

    // Limiter au nombre demandé
    if (count($terms) > $limit) {
        $terms = array_slice($terms, 0, $limit);
    }

    // Mapper la réponse
    $out = [];
    foreach ($terms as $t) {
        $link = get_term_link($t);
        if (is_wp_error($link)) $link = '';

        $out[] = [
            'id'        => intval($t->term_id),
            'slug'      => $t->slug,
            'name'      => $t->name,
            'count'     => intval($t->count),
            'permalink' => $link,
        ];
    }

    return new WP_REST_Response($out, 200);
}
