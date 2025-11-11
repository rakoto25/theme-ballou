<?php

/**
 * Template Name: Page checkout (Ballou) – Corrigé : initialLines map key→id, fallback full (prix/names), debug inline
 * Description: Page Checkout hybride (initialLines pour React hydration + fetch frais, fallback serveur si JS off)
 */
if (!defined('ABSPATH')) exit;

get_header();

// 1) Enqueue Vite (idempotent + nonce pour security)
if (function_exists('ballou_maybe_enqueue_vite')) {
    ballou_maybe_enqueue_vite();
}

// 2) Helpers si pas loaded (de rest_cart.php – include si séparé)
if (!function_exists('ballou_read_cookie_lines')) {
    // Copiez ballou_read_cookie_lines(), ballou_coerce_lines(), etc. de rest_cart.php ici ou require_once
    require_once get_template_directory() . '/rest-api/rest_cart.php'; // Assume chemin
}

// 3) Initial address default
$initial_address = [
    'country'   => 'MG',
    'postcode'  => '101',
    'city'      => 'Antananarivo',
    'address_1' => '',
    'first_name' => '',
    'last_name'  => '',
    'email'     => '',
    'phone'     => '',
];

// 4) Initial lines from cookie (map key→id string pour TS CartLine.id)
$cookie_lines = ballou_read_cookie_lines();
$initial_lines = [];
foreach ($cookie_lines as $l) {
    $line_id = $l['key']; // String ex: '613_0'
    // Build basic line (TS fetch enrichira name/price)
    $initial_lines[] = [
        'id'        => $line_id, // CORRIGÉ : Map key→id
        'product_id' => intval($l['product_id']),
        'qty'       => intval($l['qty']),
        // Bonus : Name/price TTC si possible (pour fallback)
        'name'      => '',
        'unit_price' => 0,
    ];
    $product = wc_get_product($l['product_id']);
    if ($product && $product->is_purchasable()) {
        $initial_lines[sizeof($initial_lines) - 1]['name'] = $product->get_name();
        $initial_lines[sizeof($initial_lines) - 1]['unit_price'] = wc_get_price_including_tax($product);
    }
}

// Props island
$island_props = [
    'initialAddress' => $initial_address,
    'initialLines'   => $initial_lines, // NOUVEAU : Pour hydration React (évite fetch initial si lag)
];

// Debug (WP_DEBUG + data-attr pour console)
$debug_data = [
    'cookie_lines_count' => count($cookie_lines),
    'initial_lines'      => $initial_lines, // JSON safe
];
if (defined('WP_DEBUG') && WP_DEBUG) {
    error_log("[Page Checkout Debug] Cookie lines count: " . count($cookie_lines) . ", initialLines: " . json_encode($initial_lines));
}
?>

<main class="container mx-auto px-4 py-8 mt-[20px]">
    <div
        id="checkout-island"
        data-island="checkout"
        data-props="<?php echo esc_attr(wp_json_encode($island_props)); ?>"
        data-debug="<?php echo esc_attr(wp_json_encode($debug_data)); ?>">
        <!-- Fallback serveur (si JS off ou load slow – full maintenant avec prix) -->
        <h1 class="text-2xl font-bold mb-4">Validation de commande</h1>

        <?php if (empty($cookie_lines)) : ?>
            <div class="text-center py-12">
                <h2 class="text-xl font-semibold mb-4 text-slate-600">Panier vide</h2>
                <p class="text-sm text-slate-500 mb-6">Aucun produit actif (tous retirés). Vérifiez votre panier.</p>
                <a href="/panier" class="inline-block bg-[#e94e1a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#d14416] text-center">
                    [Retour au panier](http://localhost/panier)
                </a>
            </div>
        <?php else : ?>
            <div class="text-center py-8 mb-6">
                <div class="text-sm text-slate-500 mb-2">Panier chargé (<?php echo count($cookie_lines); ?> items)...</div>
                <div class="text-sm text-slate-500">Chargement du formulaire de paiement…</div>
            </div>

            <!-- Fallback full si JS off : Liste avec prix TTC, sous-total -->
            <div class="grid md:grid-cols-2 gap-6 mb-8 hidden md:grid"> <!-- Hidden mobile pour React -->
                <div>
                    <h2 class="text-lg font-semibold mb-4">Vos produits</h2>
                    <ul class="space-y-3">
                        <?php
                        $subtotal_ttc = 0;
                        foreach ($initial_lines as $l) :
                            $line_total = $l['qty'] * $l['unit_price'];
                            $subtotal_ttc += $line_total;
                        ?>
                            <li class="flex justify-between py-2 border-b border-slate-200">
                                <span class="flex-1"><?php echo esc_html($l['name'] ?: 'Produit #' . $l['product_id']); ?> × <?php echo $l['qty']; ?></span>
                                <span class="font-medium"><?php echo wc_price($line_total); ?></span>
                            </li>
                        <?php endforeach; ?>
                        <li class="flex justify-between pt-4 font-semibold">
                            <span>Sous-total TTC</span>
                            <span><?php echo wc_price($subtotal_ttc); ?></span>
                        </li>
                    </ul>
                </div>
                <div>
                    <h2 class="text-lg font-semibold mb-4">Adresse de livraison</h2>
                    <p class="text-sm text-slate-600 mb-4"><?php echo esc_html($initial_address['address_1'] ?: 'Non renseignée'); ?>, <?php echo esc_html($initial_address['city']); ?> <?php echo esc_html($initial_address['postcode']); ?></p>
                    <p class="text-sm text-slate-500">Pays : Madagascar</p>
                    <!-- Form basique si off – mais React gère -->
                </div>
            </div>

            <!-- Bouton fallback si besoin -->
            <div class="text-center hidden md:block">
                <p class="text-sm text-slate-500 mb-4">Si le formulaire ne charge pas, <a href="/panier" class="text-[#e94e1a] underline">retournez au panier</a>.</p>
            </div>
        <?php endif; ?>
    </div>
</main>

<?php get_footer(); ?>