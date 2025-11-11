<?php
if (!defined('ABSPATH')) exit;

/**
 * Helpers : compter les produits publiés ET visibles en catalogue pour une catégorie.
 * - Exclut "exclude-from-catalog"
 */
function mf_count_products_in_cat($term_id)
{
    if (!function_exists('wc_get_product_visibility_term_ids')) {
        return 0;
    }

    $vis = wc_get_product_visibility_term_ids(); // ['exclude-from-catalog'=>…, 'exclude-from-search'=>…, 'outofstock'=>…]
    $exclude_from_catalog = isset($vis['exclude-from-catalog']) ? intval($vis['exclude-from-catalog']) : 0;

    $tax_query = array(
        'relation' => 'AND',
        array(
            'taxonomy' => 'product_cat',
            'field'    => 'term_id',
            'terms'    => array(intval($term_id)),
            'operator' => 'IN',
        ),
        // Exclure ce qui ne doit pas apparaître au catalogue
        array(
            'taxonomy' => 'product_visibility',
            'field'    => 'term_id',
            'terms'    => array($exclude_from_catalog),
            'operator' => 'NOT IN',
        ),
    );

    $args = array(
        'post_type'           => 'product',
        'post_status'         => 'publish',
        'posts_per_page'      => 1,     // on veut juste le total
        'fields'              => 'ids',
        'tax_query'           => $tax_query,
        'no_found_rows'       => false, // nécessaire pour $wp_query->found_posts
        'ignore_sticky_posts' => true,
    );

    $wpq = new WP_Query($args);
    $total = intval($wpq->found_posts);
    wp_reset_postdata();

    return $total;
}

/**
 * Retourne un permalink sûr (string) pour un term (product_cat)
 */
function mf_safe_term_link($term)
{
    $link = get_term_link($term);
    if (is_wp_error($link)) {
        return '';
    }
    return $link;
}

/**
 * Récupérer les enfants d’un term parent + compter (direct + descendants)
 * Sortie : tableau d’objets [
 *   term_id, slug, name, label, count, count_sum, permalink, url, children:[…]
 * ]
 */
function mf_get_children_with_counts($parent_term_id)
{
    $children = get_terms(array(
        'taxonomy'   => 'product_cat',
        'orderby'    => 'name',
        'hide_empty' => false,     // on gère nous-même la visibilité via mf_count_products_in_cat
        'parent'     => $parent_term_id,
    ));

    $out = array();

    if (!empty($children) && !is_wp_error($children)) {
        foreach ($children as $child) {
            $slug = $child->slug ?? '';
            $name = $child->name ?? '';

            // Skip "Non classé"
            if ($slug === 'uncategorized' || $slug === 'non-classe' || stripos($name, 'non class') !== false) {
                continue;
            }

            // Compte direct (dans cette catégorie)
            $count_direct  = mf_count_products_in_cat($child->term_id);

            // Récursif : petits-enfants
            $grandchildren = mf_get_children_with_counts($child->term_id);

            // Somme des descendants
            $sum_kids = 0;
            foreach ($grandchildren as $gc) {
                $sum_kids += isset($gc['count_sum'])
                    ? intval($gc['count_sum'])
                    : (isset($gc['count']) ? intval($gc['count']) : 0);
            }

            $permalink = mf_safe_term_link($child);

            $out[] = array(
                'term_id'   => intval($child->term_id),
                'slug'      => $slug,
                'name'      => $name,
                'label'     => $name,
                'count'     => intval($count_direct),                 // produits directement dans la catégorie
                'count_sum' => intval($count_direct + $sum_kids),     // direct + descendants
                'permalink' => $permalink,
                'url'       => $permalink,                            // alias pratique côté front
                'children'  => $grandchildren,
            );
        }
    }

    return $out;
}

/**
 * Endpoint principal : /wp-json/site-info/v1/product-categories
 * Retourne les catégories parentes avec :
 * - count (direct)
 * - count_sum (direct + descendants)
 * - children (même structure, récursif)
 * - permalink / url pour chaque term
 */
function get_product_categories_rest_api()
{
    $parents = get_terms(array(
        'taxonomy'   => 'product_cat',
        'orderby'    => 'name',
        'hide_empty' => false,   // on contrôle nous-même via le compteur
        'parent'     => 0,
    ));

    if (empty($parents) || is_wp_error($parents)) {
        return new WP_REST_Response('No categories found', 404);
    }

    $result = array();

    foreach ($parents as $cat) {
        $slug = $cat->slug ?? '';
        $name = $cat->name ?? '';

        // Skip "Non classé"
        if ($slug === 'uncategorized' || $slug === 'non-classe' || stripos($name, 'non class') !== false) {
            continue;
        }

        // Compte direct
        $count_direct = mf_count_products_in_cat($cat->term_id);

        // Enfants
        $children     = mf_get_children_with_counts($cat->term_id);

        // Somme des enfants (count_sum si dispo, sinon count)
        $sum_children = 0;
        foreach ($children as $c) {
            $sum_children += isset($c['count_sum'])
                ? intval($c['count_sum'])
                : (isset($c['count']) ? intval($c['count']) : 0);
        }

        $permalink = mf_safe_term_link($cat);

        $result[] = array(
            'term_id'   => intval($cat->term_id),
            'slug'      => $slug,
            'name'      => $name,
            'label'     => $name,
            'count'     => intval($count_direct),                 // produits directement dans le parent
            'count_sum' => intval($count_direct + $sum_children), // parent + enfants
            'permalink' => $permalink,
            'url'       => $permalink,                            // alias pratique côté front
            'children'  => $children,
        );
    }

    // Tri par popularité (desc) – vous pouvez changer vers name/slug si besoin
    usort($result, function ($a, $b) {
        return intval($b['count_sum']) <=> intval($a['count_sum']);
    });

    return new WP_REST_Response($result, 200);
}

/**
 * Enregistrement du endpoint
 */
function register_product_categories_endpoint()
{
    register_rest_route('site-info/v1', '/product-categories', array(
        'methods'             => 'GET',
        'callback'            => 'get_product_categories_rest_api',
        'permission_callback' => '__return_true',
    ));
}
add_action('rest_api_init', 'register_product_categories_endpoint');
