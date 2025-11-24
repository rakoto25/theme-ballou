<?php
if (!defined('ABSPATH')) exit;

// Bloque tout output statique WooCommerce pour forcer React (évite leaks)
remove_all_actions('woocommerce_single_product_summary');

get_header();

// Charge explicitement le produit via l'ID du post courant (robuste, évite dépendance globale)
$product = wc_get_product(get_the_ID());

// Vérifie si c'est un vrai objet WooCommerce ; sinon, log erreur et fallback
if (!is_a($product, 'WC_Product')) {
    error_log('Erreur WooCommerce : Produit non valide pour ID ' . get_the_ID());
    $product_data = []; // Fallback vide : React gérera l'erreur (ex. : "Produit non trouvé")
} else {
    // Récupère attributs/dimensions (ex. : 'pa_dimension' ou custom meta)
    $attributes = $product->get_attributes();
    $dimensions = '';
    if (isset($attributes['pa_dimension'])) {
        $dimensions = wc_get_product_terms($product->get_id(), 'pa_dimension', ['fields' => 'names'])[0] ?? '';
    } elseif ($product->get_meta('_product_dimensions')) {
        $dimensions = $product->get_meta('_product_dimensions');
    }

    // FIX IMAGES : Inclut featured + galerie, mappe à full URLs (évite fetch React)
    $image_ids = array_merge([$product->get_image_id()], $product->get_gallery_image_ids());
    $image_urls = [];
    foreach ($image_ids as $id) {
        if ($id) {
            $url = wp_get_attachment_url($id);
            if ($url) {
                $image_urls[] = $url;
            } else {
                error_log("Image ID {$id} non trouvée pour produit {$product->get_id()}");
            }
        }
    }
    error_log('Product image URLs: ' . print_r($image_urls, true));

    $product_data = [
        'id' => $product->get_id(),
        'slug' => $product->get_slug(),
        'title' => $product->get_name(),
        'price' => $product->get_price_html(),
        'description' => $product->get_description(),
        'dimensions' => $dimensions,
        'images' => $image_ids,
        'imageUrls' => $image_urls,
        'add_to_cart_url' => $product->add_to_cart_url(),
        'stock_status' => $product->get_stock_status(),
        'sku' => $product->get_sku(),
        'meta' => $product->get_meta_data(true),
    ];
}
?>

<div class="container mt-[80px] mb-[40px]" style="margin-top: 80px; margin-bottom: 40px;">
    <?php woocommerce_breadcrumb(); ?>
    <div class="product-layout grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="product-media order-1 lg:order-1"
            data-island="gallery"
            data-props='<?php echo wp_json_encode(['imageUrls' => $product_data['imageUrls'] ?? [], 'images' => $product_data['images'] ?? []]); ?>'>
        </div>
        <div class="product-summary order-2 lg:order-2" id="product-summary"
            data-island="singleproduct"
            data-props='<?php echo wp_json_encode($product_data); ?>'>
        </div>
    </div>

    <?php get_template_part('pages/partials/similar-product'); ?>
</div>

<?php get_footer(); ?>