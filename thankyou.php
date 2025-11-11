<?php
// 1. Redirection après commande réussie vers URL virtuelle /merci/{order_id}/ (inchangé, backup pour flux Woo natif)
add_action('woocommerce_thankyou', 'redirect_to_virtual_thankyou');
function redirect_to_virtual_thankyou($order_id)
{
    $order = wc_get_order($order_id);
    if ($order && ! $order->has_status('failed')) {
        $url = home_url('/merci/' . $order_id . '/?key=' . $order->get_order_key());
        wp_safe_redirect($url);
        exit;
    }
}

// 2. Règle de réécriture pour l'URL virtuelle /merci/{order_id}/ (inchangé)
add_action('init', 'add_virtual_thankyou_rewrite');
function add_virtual_thankyou_rewrite()
{
    add_rewrite_rule('^merci/([0-9]+)/?', 'index.php?virtual_thankyou=1&order_id=$matches[1]', 'top');
}

// 3. Ajout de la query var pour détecter l'URL (inchangé)
add_filter('query_vars', 'add_virtual_thankyou_query_var');
function add_virtual_thankyou_query_var($vars)
{
    $vars[] = 'virtual_thankyou';
    $vars[] = 'order_id';
    return $vars;
}

// 4. Hook pour charger le contenu personnalisé sur l'URL virtuelle (corrigé : Islands + Event pour Hide Static)
add_action('template_redirect', 'handle_virtual_thankyou');
function handle_virtual_thankyou()
{
    if (get_query_var('virtual_thankyou') && $order_id = get_query_var('order_id')) {
        $order_key = isset($_GET['key']) ? sanitize_text_field($_GET['key']) : '';
        $order = wc_get_order($order_id);

        if (! $order || $order_key !== $order->get_order_key()) {
            wp_die('Accès non autorisé à la commande.', 'Erreur', array('response' => 403));
        }

        // Enqueue bundle principal (main.tsx compilé, inclut registry avec thankyou)
        wp_enqueue_script('main-bundle', get_template_directory_uri() . '/assets/js/main.bundle.js', array('jquery'), '1.0', true);
        wp_enqueue_style('thankyou-styles', get_template_directory_uri() . '/assets/css/thankyou.css', array(), '1.0'); // Tailwind/CSS spécifique

        // Rendu de la page complète
        get_header();

        // Meta SEO dynamiques (noindex pour privacy)
        add_action('wp_head', function () use ($order, $order_id) {
            if ($order) {
                echo '<title>Merci pour votre commande #' . esc_html($order_id) . ' - ' . get_bloginfo('name') . '</title>';
                echo '<meta name="description" content="Confirmation de commande #' . esc_html($order_id) . '. Détails et suivi chez ' . get_bloginfo('name') . '.">';
                echo '<meta name="robots" content="noindex, nofollow">';
                // OpenGraph pour share (optionnel)
                echo '<meta property="og:title" content="Commande #' . esc_html($order_id) . ' confirmée">';
                echo '<meta property="og:description" content="Merci pour votre achat !">';
            }
        });

        // Contenu principal (statique pour SEO + island conteneur)
?>
        <div id="primary" class="content-area">
            <main id="main" class="site-main">
                <div class="thankyou-container max-w-4xl mx-auto mt-20 px-4">
                    <!-- Contenu statique pour SEO (caché après mount via event) -->
                    <div id="thankyou-static" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
                        <h1 class="text-2xl font-bold text-green-600 mb-4">Merci pour votre commande !</h1>
                        <p class="text-slate-600 mb-6">Votre commande #<?php echo esc_html($order_id); ?> a été reçue avec succès. Statut: <?php echo ucfirst(esc_html($order->get_status())); ?>.</p>
                        <p class="text-sm text-slate-500 mb-8">Date: <?php echo $order->get_date_created()->format('d/m/Y à H:i'); ?> | Un email de confirmation vous a été envoyé.</p>
                        <div class="bg-slate-50 rounded-xl p-4 mb-6">
                            <h2 class="text-lg font-semibold mb-4">Récapitulatif rapide</h2>
                            <p class="text-sm">Total: <?php echo wc_price($order->get_total()); ?></p>
                            <p class="text-sm">Paiement: <?php echo esc_html($order->get_payment_method_title()); ?></p>
                            <?php if ($order->has_status('pending')): ?>
                                <p class="text-sm text-orange-600 mt-2">Instructions de paiement envoyées par email. Suivez-les pour finaliser.</p>
                            <?php endif; ?>
                        </div>
                    </div>

                    <!-- Island React (main.tsx monte auto avec props JSON ; caché initial) -->
                    <div
                        data-island="thankyou"
                        data-props='<?php echo json_encode([
                                        "orderId" => intval($order_id),
                                        "orderKey" => $order_key,
                                        "apiBase" => get_rest_url()
                                    ], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES); ?>'
                        class="bg-white rounded-2xl shadow-sm border border-slate-100 p-8"
                        style="display: none; min-height: 600px;"></div>
                </div>
            </main>
        </div>

        <!-- Script pour hide static après mount (via event émis par thankyou.tsx) -->
        <script type="text/javascript">
            (function() {
                const staticEl = document.getElementById('thankyou-static');
                const islandEl = document.querySelector('[data-island="thankyou"]');

                // Écoute event 'island-mounted' émis par Thankyou après fetch succès
                document.addEventListener('island-mounted', function(e) {
                    if (e.detail && e.detail.island === 'thankyou' && islandEl) {
                        islandEl.style.display = 'block';
                        if (staticEl) staticEl.style.display = 'none';
                        console.log('[Thankyou Page] Static hidden after mount');
                    }
                });

                // Fallback timeout si pas d'event (ex: erreur fetch ; garde static visible)
                setTimeout(() => {
                    if (islandEl && islandEl.innerHTML.trim() !== '' && !islandEl.style.display.includes('none')) {
                        islandEl.style.display = 'block';
                        if (staticEl) staticEl.style.display = 'none';
                    }
                }, 1000); // Délai pour fetch async
            })();
        </script>
<?php

        get_footer();
        exit; // Arrête le chargement normal de WP
    }
}

// Flush rewrite rules à l'activation (exécutez une fois en admin ou via plugin)
register_activation_hook(__FILE__, 'flush_rewrite_rules_on_activate');
function flush_rewrite_rules_on_activate()
{
    add_virtual_thankyou_rewrite();
    flush_rewrite_rules();
}
?>