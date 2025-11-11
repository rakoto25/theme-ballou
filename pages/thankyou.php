<?php
/*
 * Template Name: Thankyou page
 * Description: Page de remerciement WooCommerce (clé sécurisée) + React Island
 */
if (!defined('ABSPATH')) exit;

// ------------------------------------------------------------------
// 1) Récupération & validation des paramètres
//    - Supporte /merci/?key=wc_order_xxx   (recommandé)
//    - Supporte /merci/{id}/?key=...       (legacy/compat)
// ------------------------------------------------------------------
$order_key = isset($_GET['key']) ? sanitize_text_field($_GET['key']) : '';
$order_id  = 0;

// Si un order_id est passé (via rewrite ou query), on le prend
if (isset($_GET['order_id'])) {
    $order_id = absint($_GET['order_id']);
} elseif (get_query_var('order_id')) {
    $order_id = absint(get_query_var('order_id'));
}

// Si on n'a pas d'ID mais on a la clé → on retrouve l’ID depuis la clé
if (!$order_id && $order_key) {
    $maybe_id = wc_get_order_id_by_order_key($order_key);
    if ($maybe_id) {
        $order_id = absint($maybe_id);
    }
}

// Charge la commande si un ID a été résolu
$order = $order_id ? wc_get_order($order_id) : false;

// Vérifie la clé (obligatoire) + correspondance
$access_ok = false;
if ($order && $order_key && $order_key === $order->get_order_key()) {
    $access_ok = true;
}

// ------------------------------------------------------------------
// 2) Meta <head> (noindex + title/desc dynamiques)
//    IMPORTANT : déclarer AVANT get_header() pour que wp_head les imprime
// ------------------------------------------------------------------
add_action('wp_head', function () use ($access_ok, $order_id) {
    echo '<meta name="robots" content="noindex, nofollow">' . PHP_EOL;
    if ($access_ok) {
        echo '<title>' .
            esc_html(sprintf(__('Merci pour votre commande #%d', 'woocommerce'), $order_id)) .
            ' - ' . esc_html(get_bloginfo('name')) . '</title>' . PHP_EOL;
        echo '<meta name="description" content="' .
            esc_attr(sprintf(__('Confirmation de commande #%d', 'woocommerce'), $order_id)) .
            '">' . PHP_EOL;
        echo '<meta property="og:title" content="' .
            esc_attr(sprintf(__('Commande #%d confirmée', 'woocommerce'), $order_id)) . '">' . PHP_EOL;
        echo '<meta property="og:description" content="' . esc_attr(__('Merci pour votre achat !', 'woocommerce')) . '">' . PHP_EOL;
    } else {
        echo '<title>' . esc_html__('Accès non autorisé', 'woocommerce') . ' - ' . esc_html(get_bloginfo('name')) . '</title>' . PHP_EOL;
    }
}, 1);

// ------------------------------------------------------------------
// 3) Enqueue Vite (manifest) — PAS d’enqueue manuel de bundle
// ------------------------------------------------------------------
if (function_exists('ballou_maybe_enqueue_vite')) {
    ballou_maybe_enqueue_vite(); // idempotent
}

get_header();

// ------------------------------------------------------------------
// 4) Si accès invalide → message clair + lien compte
// ------------------------------------------------------------------
if (!$access_ok): ?>
    <main id="main" class="site-main">
        <div class="max-w-3xl mx-auto my-20 px-4">
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
                <h1 class="text-2xl font-bold text-red-600 mb-4"><?php echo esc_html__('Accès non autorisé', 'woocommerce'); ?></h1>
                <p class="text-slate-600">
                    <?php echo esc_html__("Impossible d’afficher cette commande. Vérifiez le lien de confirmation.", 'woocommerce'); ?>
                </p>
                <div class="mt-6">
                    <a class="text-blue-600 underline" href="<?php echo esc_url(wc_get_page_permalink('myaccount')); ?>">
                        <?php echo esc_html__('Retour à mon compte', 'woocommerce'); ?>
                    </a>
                </div>
            </div>
        </div>
    </main>
<?php get_footer();
    return;
endif;

// ------------------------------------------------------------------
// 5) Contenu statique (fallback SEO) + Island React
// ------------------------------------------------------------------
?>
<main id="main" class="site-main">
    <div class="thankyou-container max-w-4xl mx-auto mt-20 px-4">
        <!-- Fallback statique (visible si JS HS ou si island échoue) -->
        <div id="thankyou-static" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <h1 class="text-2xl font-bold text-green-600 mb-4">
                <?php echo esc_html__('Merci pour votre commande !', 'woocommerce'); ?>
            </h1>
            <p class="text-slate-600 mb-6">
                <?php
                /* translators: %1$s: order id, %2$s: order status */
                printf(
                    esc_html__('Votre commande #%1$s a été reçue avec succès. Statut : %2$s.', 'woocommerce'),
                    esc_html($order_id),
                    esc_html(ucfirst($order->get_status()))
                );
                ?>
            </p>
            <p class="text-sm text-slate-500 mb-8">
                <?php
                $created = $order->get_date_created();
                $date_i18n = $created ? $created->date_i18n('d/m/Y \à H:i') : '';
                echo esc_html(sprintf(__('Date : %s | Un email de confirmation vous a été envoyé.', 'woocommerce'), $date_i18n));
                ?>
            </p>
            <div class="bg-slate-50 rounded-xl p-4 mb-6">
                <h2 class="text-lg font-semibold mb-4"><?php echo esc_html__('Récapitulatif rapide', 'woocommerce'); ?></h2>
                <p class="text-sm">
                    <?php echo esc_html__('Total :', 'woocommerce'); ?>
                    <?php echo wp_kses_post(wc_price($order->get_total())); ?>
                </p>
                <p class="text-sm">
                    <?php echo esc_html__('Paiement :', 'woocommerce'); ?>
                    <?php echo esc_html($order->get_payment_method_title()); ?>
                </p>
                <?php if ($order->has_status('pending')): ?>
                    <p class="text-sm text-orange-600 mt-2">
                        <?php echo esc_html__("Instructions de paiement envoyées par email. Suivez-les pour finaliser.", 'woocommerce'); ?>
                    </p>
                <?php endif; ?>
            </div>
        </div>

        <!-- Island React : montheme/assets/src/islands/thankyou.tsx -->
        <div
            data-island="thankyou"
            data-props='<?php echo wp_json_encode([
                            "orderId"  => (int) $order_id,
                            "orderKey" => (string) $order_key,
                            "apiBase"  => rtrim(get_rest_url(), '/'), // ex: https://site.tld/wp-json
                        ], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES); ?>'
            class="bg-white rounded-2xl shadow-sm border border-slate-100 p-8"
            style="display:none; min-height:600px;"></div>
    </div>
</main>

<!-- 6) Masquer le fallback quand l’island est monté -->
<script>
    (function() {
        const staticEl = document.getElementById('thankyou-static');
        const islandEl = document.querySelector('[data-island="thankyou"]');

        // L’island React émettra : document.dispatchEvent(new CustomEvent('island-mounted', { detail: { island: 'thankyou' }}))
        document.addEventListener('island-mounted', function(e) {
            if (e.detail && e.detail.island === 'thankyou' && islandEl) {
                islandEl.style.display = 'block';
                if (staticEl) staticEl.style.display = 'none';
                console.log('[Thankyou Page] Static hidden after island mounted');
            }
        });

        // Fallback de sûreté : si l’island a du contenu mais pas d’event
        setTimeout(function() {
            if (islandEl && islandEl.innerHTML.trim() !== '') {
                islandEl.style.display = 'block';
                if (staticEl) staticEl.style.display = 'none';
            }
        }, 1200);
    })();
</script>

<?php get_footer();
