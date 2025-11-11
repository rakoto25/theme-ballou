<?php
if (!defined('ABSPATH')) exit;

// Bloque tout output statique WooCommerce pour forcer React (évite leaks)
remove_all_actions('woocommerce_single_product_summary');

get_header();

// Charge explicitement le produit via l'ID du post courant (robuste, évite dépendance globale)
$product = wc_get_product(get_the_ID());

// Vérifie si c'est un vrai objet WooCommerce ; sinon, log erreur et fallback
if (! is_a($product, 'WC_Product')) {
    error_log('Erreur WooCommerce : Produit non valide pour ID ' . get_the_ID());
    $product_data = []; // Fallback vide : React gérera l'erreur (ex. : "Produit non trouvé")
} else {
    // Récupère attributs/dimensions (ex. : 'pa_dimension' ou custom meta)
    $attributes = $product->get_attributes();
    $dimensions = '';
    if (isset($attributes['pa_dimension'])) { // Adaptez 'pa_dimension' à votre attribut Woo (via Products > Attributes)
        $dimensions = wc_get_product_terms($product->get_id(), 'pa_dimension', ['fields' => 'names'])[0] ?? ''; // Premier terme
    } elseif ($product->get_meta('_product_dimensions')) {
        $dimensions = $product->get_meta('_product_dimensions'); // Custom field si ACF/other
    }

    // FIX IMAGES : Inclut featured + galerie, mappe à full URLs (évite fetch React)
    $image_ids = array_merge([$product->get_image_id()], $product->get_gallery_image_ids()); // Featured first + galerie
    $image_urls = [];
    foreach ($image_ids as $id) {
        if ($id) { // Skip 0/null
            $url = wp_get_attachment_url($id); // Full URL (ex. : http://site/wp-content/uploads/2023/10/image.jpg)
            if ($url) {
                $image_urls[] = $url; // Ajoute seulement si valide
            } else {
                error_log("Image ID {$id} non trouvée pour produit {$product->get_id()}");
            }
        }
    }
    // Debug : Log URLs pour vérif
    error_log('Product image URLs: ' . print_r($image_urls, true));

    $product_data = [
        'id' => $product->get_id(),
        'slug' => $product->get_slug(),
        'title' => $product->get_name(),
        'price' => $product->get_price_html(), // HTML pour affichage direct en React
        'description' => $product->get_description(), // Contenu HTML
        'dimensions' => $dimensions, // Ajout pour meta comme "160x230 cm"
        'images' => $image_ids, // IDs pour backward compat (singleproduct fallback)
        'imageUrls' => $image_urls, // NOUVEAU : Full URLs directes pour gallery (array strings)
        'add_to_cart_url' => $product->add_to_cart_url(), // Utile pour bouton React
        'stock_status' => $product->get_stock_status(), // Ex. : 'instock' pour checks dynamiques
        'meta' => $product->get_meta_data(true), // Meta filtrés (true pour values only)
    ];
}
?>
<div class="container mt-[80px] mb-[40px]" style="margin-top: 80px; margin-bottom: 40px;"> <!-- Margins arbitraires Tailwind + inline (80px top pour header fixe, 40px bottom) -->
    <?php woocommerce_breadcrumb(); ?>
    <div class="product-layout grid grid-cols-1 lg:grid-cols-2 gap-8"> <!-- Grid responsive : galerie gauche, summary droite -->
        <div class="product-media order-1 lg:order-1" data-island="gallery" data-props='<?php echo wp_json_encode(['imageUrls' => $product_data['imageUrls'] ?? [], 'images' => $product_data['images'] ?? []]); ?>'></div> <!-- Gauche : Galerie avec URLs directes -->
        <div class="product-summary order-2 lg:order-2" id="product-summary" data-island="singleproduct" data-props='<?php echo wp_json_encode($product_data); ?>'></div> <!-- Droite : Détails -->
    </div>
</div>
<?php get_footer(); ?>