<?php
if (!defined('ABSPATH')) exit;


// Exemple d’end-point AJAX pour facettes (fetch côté client) tout en conservant un rendu serveur crawlable
add_action('wp_ajax_ballou_filter_products', 'ballou_filter_products');
add_action('wp_ajax_nopriv_ballou_filter_products', 'ballou_filter_products');


function ballou_filter_products()
{
    check_ajax_referer('ballou-nonce', 'nonce');


    // Lire quelques paramètres (exemple : cat, marque, page)
    $cat = sanitize_text_field($_GET['cat'] ?? '');
    $brand = sanitize_text_field($_GET['brand'] ?? '');
    $paged = max(1, intval($_GET['page'] ?? 1));


    $tax_query = [];
    if ($cat) $tax_query[] = ['taxonomy' => 'product_cat', 'field' => 'slug', 'terms' => $cat];
    if ($brand) $tax_query[] = ['taxonomy' => 'pa_marque', 'field' => 'slug', 'terms' => $brand];


    $q = new WP_Query([
        'post_type' => 'product',
        'post_status' => 'publish',
        'posts_per_page' => 24,
        'paged' => $paged,
        'tax_query' => $tax_query
    ]);


    ob_start();
    if ($q->have_posts()) {
        echo '<div class="ballou-grid">';
        while ($q->have_posts()) {
            $q->the_post();
            global $product; ?>
            <article class="ballou-card">
                <a href="<?php the_permalink(); ?>">
                    <?php echo woocommerce_get_product_thumbnail('woocommerce_thumbnail'); ?>
                    <h3 class="ballou-title"><?php the_title(); ?></h3>
                    <div class="ballou-price"><?php echo $product->get_price_html(); ?></div>
                </a>
                <?php woocommerce_template_loop_add_to_cart(); ?>
            </article>
<?php }
        echo '</div>';
        // Pagination minimale
        echo '<nav class="ballou-pagination">' . paginate_links(['total' => $q->max_num_pages, 'current' => $paged]) . '</nav>';
    } else {
        echo '<p>Aucun produit.</p>';
    }
    wp_reset_postdata();


    $html = ob_get_clean();
    wp_send_json_success(['html' => $html]);
}
