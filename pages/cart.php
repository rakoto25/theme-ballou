<?php

/**
 * Template Name: Panier (Ballou)
 * Description: Page Panier hybride (SEO: contenu serveur + îlot React "cart")
 */
if (!defined('ABSPATH')) exit;
get_header();

// Lecture des lignes du cookie (id = product_id, qty)
$cookie_lines = function_exists('ballou_read_cookie_lines') ? ballou_read_cookie_lines() : [];

/** Calcul du fallback serveur (HT) **/
$fallback_items     = [];
$fallback_currency  = function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'MGA';
$fallback_subtotal  = 0.0;
$fallback_count_qty = 0;

foreach ($cookie_lines as $line) {
    $pid = isset($line['id']) ? (int) $line['id'] : 0;
    $qty = isset($line['qty']) ? max(1, (int) $line['qty']) : 0;

    if ($pid <= 0 || $qty <= 0) continue;

    $p = wc_get_product($pid);
    if (!$p instanceof WC_Product) continue;

    $img        = $p->get_image_id()
        ? wp_get_attachment_image_url($p->get_image_id(), 'woocommerce_thumbnail')
        : wc_placeholder_img_src('woocommerce_thumbnail');
    $name       = $p->get_name();
    $href       = get_permalink($p->get_id());
    $unit       = (float) wc_get_price_excluding_tax($p);
    $line_total = $unit * $qty;

    $fallback_subtotal  += $line_total;
    $fallback_count_qty += $qty;

    $fallback_items[] = [
        'id'   => $p->get_id(),
        'img'  => $img,
        'name' => $name,
        'href' => $href,
        'qty'  => $qty,
        'unit' => $unit,
        'line' => $line_total,
    ];
}

// Props init pour l’îlot React (peuvent être étendus)
$island_props = [
    'address' => [
        'country'   => 'MG',
        'postcode'  => '101',
        'city'      => 'Antananarivo',
        'address_1' => '',
    ],
];

// Détermine la base REST à injecter côté client (optionnel mais robuste)
$rest_base = esc_url_raw(trailingslashit(rest_url())); // ex: https://site.tld/wp-json/
?>
<main class="container mx-auto max-w-7xl px-4 md:px-6 py-8">
    <!-- STEPper -->
    <nav class="mb-8" aria-label="Checkout steps">
        <ol class="flex items-center gap-3 text-sm">
            <li class="flex items-center gap-2">
                <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#29235c] text-white">1</span>
                <span class="font-medium text-[#29235c]">Panier</span>
            </li>
            <li class="text-[#29235c]/30">—</li>
            <li class="flex items-center gap-2 opacity-50">
                <span class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#29235c]/30">2</span>
                <span>Adresse</span>
            </li>
            <li class="text-[#29235c]/30">—</li>
            <li class="flex items-center gap-2 opacity-50">
                <span class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#29235c]/30">3</span>
                <span>Paiement</span>
            </li>
        </ol>
    </nav>

    <!-- Îlot React: CART -->
    <section
        data-island="cart"
        data-props='<?php echo esc_attr(wp_json_encode($island_props)); ?>'
        class="grid lg:grid-cols-[1fr,380px] gap-8">

        <!-- Fallback serveur -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100">
            <header class="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <h1 class="text-xl font-semibold text-[#29235c]">Votre panier</h1>
                <span class="text-sm text-slate-500">
                    <?php echo intval($fallback_count_qty); ?> article(s)
                </span>
            </header>

            <?php if (empty($fallback_items)) : ?>
                <div class="p-6 text-slate-600">
                    Votre panier est vide.
                    <a href="<?php echo esc_url(home_url('/produits')); ?>" class="text-[#e94e1a] underline">
                        Continuer vos achats
                    </a>.
                </div>
            <?php else : ?>
                <!-- Desktop Table -->
                <div class="hidden md:block">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-left text-slate-500">
                                <th class="px-6 py-4 w-[120px]">Produit</th>
                                <th class="px-6 py-4"></th>
                                <th class="px-6 py-4">Prix (HT)</th>
                                <th class="px-6 py-4">Quantité</th>
                                <th class="px-6 py-4">Sous-total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($fallback_items as $it): ?>
                                <tr class="border-t border-slate-100">
                                    <td class="px-6 py-4">
                                        <img src="<?php echo esc_url($it['img']); ?>" alt="<?php echo esc_attr($it['name']); ?>" class="h-20 w-20 rounded-xl object-cover" />
                                    </td>
                                    <td class="px-6 py-4">
                                        <a href="<?php echo esc_url($it['href']); ?>" class="font-medium hover:underline" style="color:#29235c">
                                            <?php echo esc_html($it['name']); ?>
                                        </a>
                                    </td>
                                    <td class="px-6 py-4">
                                        <?php echo wc_price($it['unit'], ['currency' => $fallback_currency]); ?>
                                    </td>
                                    <td class="px-6 py-4"><?php echo intval($it['qty']); ?></td>
                                    <td class="px-6 py-4 font-semibold">
                                        <?php echo wc_price($it['line'], ['currency' => $fallback_currency]); ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            <tr class="border-t border-slate-100 bg-slate-50/50">
                                <td colspan="4" class="px-6 py-4 text-right font-medium">Sous-total (HT)</td>
                                <td class="px-6 py-4 font-bold" style="color:#29235c">
                                    <?php echo wc_price($fallback_subtotal, ['currency' => $fallback_currency]); ?>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Mobile Cards -->
                <div class="p-6 md:hidden text-sm text-slate-600">
                    <?php foreach ($fallback_items as $it): ?>
                        <div class="flex items-center gap-3 py-3 border-b border-slate-100">
                            <img src="<?php echo esc_url($it['img']); ?>" alt="<?php echo esc_attr($it['name']); ?>" class="h-16 w-16 rounded-lg object-cover" />
                            <div class="flex-1">
                                <a href="<?php echo esc_url($it['href']); ?>" class="font-medium text-[#29235c] hover:underline">
                                    <?php echo esc_html($it['name']); ?>
                                </a>
                                <div class="text-xs text-slate-500">Qté : <?php echo intval($it['qty']); ?></div>
                            </div>
                            <div class="font-semibold">
                                <?php echo wc_price($it['line'], ['currency' => $fallback_currency]); ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    <div class="flex items-center justify-between py-4">
                        <span class="text-slate-600">Sous-total (HT)</span>
                        <span class="text-lg font-bold text-[#29235c]">
                            <?php echo wc_price($fallback_subtotal, ['currency' => $fallback_currency]); ?>
                        </span>
                    </div>
                </div>
            <?php endif; ?>
        </div>

        <!-- Récap Fallback -->
        <aside class="lg:sticky lg:top-6 h-fit">
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="px-6 py-5 border-b border-slate-100">
                    <h2 class="text-lg font-semibold" style="color:#29235c">Récapitulatif</h2>
                </div>
                <div class="px-6 py-5 space-y-3 text-sm">
                    <div class="flex items-center justify-between">
                        <span class="text-slate-600">Sous-total (HT)</span>
                        <span class="font-bold"><?php echo wc_price($fallback_subtotal, ['currency' => $fallback_currency]); ?></span>
                    </div>
                    <p class="text-xs text-slate-500">
                        Les taxes, remises et frais de livraison seront calculés à l’étape suivante.
                    </p>
                    <a href="<?php echo esc_url(home_url('/checkout')); ?>" class="mt-2 block w-full text-center px-5 py-3 rounded-xl bg-[#e94e1a] text-white font-medium hover:opacity-95">
                        Passer à la caisse
                    </a>
                    <a href="<?php echo esc_url(home_url('/produits')); ?>" class="block text-center text-sm text-[#29235c] underline">
                        Continuer vos achats
                    </a>
                </div>
            </div>
        </aside>
    </section>

    <?php
    // JSON-LD Breadcrumbs
    $json_ld = [
        "@context" => "https://schema.org",
        "@type" => "BreadcrumbList",
        "itemListElement" => [
            ["@type" => "ListItem", "position" => 1, "name" => get_bloginfo('name'), "item" => home_url('/')],
            ["@type" => "ListItem", "position" => 2, "name" => "Panier", "item" => get_permalink()],
        ],
    ];
    echo '<script type="application/ld+json">' . wp_json_encode($json_ld) . '</script>';
    ?>

    <!-- Injection utilitaire front -->
    <script>
        // 1) Informe le bundle du bon endpoint REST (au cas où)
        window.__BALLOU__ = window.__BALLOU__ || {};
        // Ex: https://site.tld/wp-json  -> lib/cart.ts fera ".../ballou/v1/"
        window.__BALLOU__.apiBase = <?php echo json_encode(untrailingslashit($rest_base)); ?>;

        // 2) Petit helper pour le badge header (optionnel)
        // Place un élément dans ton header: <span data-cart-count>0</span>
        (function() {
            const COUNT_URL = (window.__BALLOU__.apiBase || (location.origin + '/wp-json')) + '/ballou/v1/cart/count';
            const target = document.querySelector('[data-cart-count]');

            async function refreshCount() {
                try {
                    const res = await fetch(COUNT_URL, {
                        credentials: 'include'
                    });
                    if (!res.ok) return;
                    const json = await res.json();
                    const n = Number(json && json.count || 0);
                    if (target) target.textContent = String(n);
                } catch (e) {}
            }

            // Écoute nos deux mécanismes de broadcast
            document.addEventListener('ballou:cart:updated', refreshCount);
            window.addEventListener('storage', function(e) {
                if (e.key === 'ballou_cart_broadcast') refreshCount();
            });

            // Init
            refreshCount();
        })();
    </script>
</main>

<?php
get_footer();
