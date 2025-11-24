<?php

/**
 * Partial: Similar Products Slider
 * Displays related products as a slider below single product details.
 * Data passed to React island for hydration.
 */

if (!defined('ABSPATH')) exit;

$current_product = wc_get_product(get_the_ID());
if (!is_a($current_product, 'WC_Product')) return;

// Utilisation du helper compatible WooCommerce pour ID produits similaires
$related_ids = wc_get_related_products($current_product->get_id(), 6);

if (empty($related_ids)) {
    $categories = wp_get_post_terms($current_product->get_id(), 'product_cat', ['fields' => 'ids']);
    if (!empty($categories)) {
        $related_products = wc_get_products([
            'category' => $categories[0],
            'limit' => 6,
            'exclude' => [$current_product->get_id()],
            'status' => 'publish',
            'paginate' => false,
        ]);
        $related_ids = array_map(fn($p) => $p->get_id(), $related_products);
    }
}

$similar_data = [];
if (!empty($related_ids)) {
    foreach ($related_ids as $id) {
        $prod = wc_get_product($id);
        if ($prod) {
            $img_ids = array_merge([$prod->get_image_id()], $prod->get_gallery_image_ids());
            $img_urls = [];
            foreach (array_slice($img_ids, 0, 1) as $img_id) {
                if ($img_id) {
                    $img_url = wp_get_attachment_url($img_id);
                    if ($img_url) $img_urls[] = $img_url;
                }
            }
            $img_url = !empty($img_urls) ? $img_urls[0] : wc_placeholder_img_src();

            $similar_data[] = [
                'id' => $prod->get_id(),
                'slug' => $prod->get_slug(),
                'title' => $prod->get_name(),
                'price' => $prod->get_price_html(),
                'imageUrl' => $img_url,
                'stock_status' => $prod->get_stock_status(),
                'sku' => $prod->get_sku() ?: '',
                'permalink' => get_permalink($prod->get_id()),
            ];
        }
    }
}

if (empty($similar_data)) return;
?>

<section class="related-products mt-12 pt-8 border-t border-gray-200">
    <h2 class="text-2xl font-bold text-center mb-6 text-[#29235c]">Produits similaires</h2>

    <div class="similar-slider" data-island="similarproduct" data-props='<?php echo esc_attr(wp_json_encode(["products" => $similar_data])); ?>'>
        <div class="island-root"></div>
    </div>

    <noscript>
        <div class="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide">
            <?php foreach ($similar_data as $prod_data) : ?>
                <a href="<?php echo esc_url($prod_data['permalink']); ?>"
                    class="flex-shrink-0 w-48 bg-white rounded-lg shadow-sm border hover:shadow-md transition-all">
                    <img src="<?php echo esc_url($prod_data['imageUrl']); ?>"
                        alt="<?php echo esc_attr($prod_data['title']); ?>"
                        class="w-full h-48 object-cover rounded-t-lg"
                        loading="lazy" />

                    <div class="p-3">
                        <h3 class="text-sm font-semibold text-[#1b1919] truncate"><?php echo esc_html($prod_data['title']); ?></h3>
                        <div class="text-[#29235c] font-bold mt-1"
                            <?php echo 'dangerouslySetInnerHTML="' . esc_attr($prod_data['price']) . '"'; ?>>
                        </div>
                        <?php if ($prod_data['stock_status'] !== 'instock') : ?>
                            <p class="text-xs text-red-500">Stock épuisé</p>
                        <?php endif; ?>
                    </div>
                </a>
            <?php endforeach; ?>
        </div>
    </noscript>
</section>