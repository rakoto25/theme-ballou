<?php

/**
 * Thankyou Order Received (Woo surcharge + React island, sans shipping + Bouton PDF)
 * your-theme/woocommerce/checkout/thankyou.php
 */
defined('ABSPATH') || exit;

get_header('shop');

global $wp;
$order_id = absint(get_query_var('order-received'));
$order_key = isset($_GET['key']) ? wc_clean($_GET['key']) : '';

$order = false;
if ($order_id > 0 && $order_key) {
    $order = wc_get_order($order_id);
    if (!$order || $order->get_order_key() !== $order_key) {
        $order = false; // Invalide
    }
}

if (!$order) {
    // Erreur statique (sans island)
?>
    <div class="container my-5 mx-auto px-4 max-w-4xl">
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <h2 class="text-2xl font-bold text-red-600 mb-4"><?php esc_html_e('Accès non autorisé', 'woocommerce'); ?></h2>
            <p class="text-slate-600"><?php esc_html_e('Commande non trouvée ou lien invalide. Vérifiez l\'email.', 'woocommerce'); ?></p>
            <div class="mt-6">
                <a class="bg-[#e94e1a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#d14416]" href="<?php echo esc_url(wc_get_page_permalink('myaccount')); ?>">
                    <?php esc_html_e('Mon compte', 'woocommerce'); ?>
                </a>
            </div>
        </div>
    </div>
<?php
    get_footer('shop');
    return;
}

// Enqueue Vite seulement si ordre valide
if (function_exists('ballou_maybe_enqueue_vite')) {
    ballou_maybe_enqueue_vite();
}

// Noindex
add_action('wp_head', function () {
    echo '<meta name="robots" content="noindex, nofollow" />' . "\n";
}, 0);

// jsPDF CDN pour fallback statique (si pas en Vite)
wp_head(); // Assure hooks
?>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<div class="container my-5 mx-auto px-4 max-w-4xl">
    <?php if ($order): ?>
        <!-- Fallback statique + Bouton Imprimer -->
        <div id="thankyou-static" class="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <h2 class="text-2xl font-bold text-blue-600 mb-4"><?php esc_html_e('Merci pour votre commande !', 'woocommerce'); ?></h2>
            <p class="text-slate-600 mb-6">
                <?php echo apply_filters('woocommerce_thankyou_order_received_text', esc_html__('Votre commande #', 'woocommerce') . $order->get_order_number() . ' a été reçue.', $order); ?>
                Statut: <?php echo esc_html(ucfirst($order->get_status())); ?>.
            </p>
            <ul class="order_details list-unstyled mb-8 space-y-2 text-left mx-auto max-w-md">
                <li><strong><?php esc_html_e('Numéro :', 'woocommerce'); ?> <?php echo $order->get_order_number(); ?></strong></li>
                <li><?php esc_html_e('Date :', 'woocommerce'); ?> <?php echo wc_format_datetime($order->get_date_created()); ?></li>
                <?php if ($order->get_payment_method_title()) : ?>
                    <li><?php esc_html_e('Paiement :', 'woocommerce'); ?> <?php echo wp_kses_post($order->get_payment_method_title()); ?></li>
                <?php endif; ?>
            </ul>
            <div class="bg-slate-50 rounded-xl p-4 mb-6">
                <h3 class="text-lg font-semibold mb-4"><?php esc_html_e('Récapitulatif', 'woocommerce'); ?></h3>
                <p>Total TTC: <?php echo wp_kses_post(wc_price($order->get_total())); ?></p>
                <p>Livraison: Gratuit (retrait local)</p>
                <?php if ($order->has_status('on-hold')) : ?>
                    <p class="text-orange-600 mt-2"><?php esc_html_e('Paiement en cours. Instructions par email.', 'woocommerce'); ?></p>
                <?php endif; ?>
            </div>
            <p class="text-sm text-slate-500 mb-6"><?php esc_html_e('Email de confirmation envoyé.', 'woocommerce'); ?></p>
            <div class="space-x-4 mb-4">
                <a href="<?php echo esc_url(wc_get_endpoint_url('orders', '', wc_get_page_permalink('myaccount'))); ?>" class="bg-[#e94e1a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#d14416] transition-colors">
                    <?php esc_html_e('Suivre mes commandes', 'woocommerce'); ?>
                </a>
                <button onclick="printOrderStatic(<?php echo json_encode(['orderId' => $order_id, 'orderKey' => $order_key]); ?>)" class="bg-gray-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-700 transition-colors">
                    <?php esc_html_e('Imprimer PDF', 'woocommerce'); ?>
                </button>
            </div>
        </div>

        <!-- Island React (seulement si valide) -->
        <div
            id="thankyou-island"
            data-island="thankyou"
            data-props='<?php echo wp_json_encode([
                            "orderId" => intval($order_id),
                            "orderKey" => $order_key,
                        ], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES); ?>'
            class="bg-white rounded-2xl shadow-sm border border-slate-100 p-8"
            style="display:none; min-height:600px;">
        </div>
    <?php endif; ?>
</div>

<script>
    // Fonction PDF pour fallback statique (utilise API + jsPDF)
    async function printOrderStatic(props) {
        try {
            const {
                orderId,
                orderKey
            } = props;
            const REST = new URL(window.location.href).origin + '/ballou/wp-json'; // Force path
            const url = `${REST}/wc/v3/merci/${orderId}?key=${orderKey}`;

            const response = await fetch(url, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Erreur fetch');

            const order = await response.json();

            const {
                jsPDF
            } = window.jspdf;
            const doc = new jsPDF();

            // En-tête
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('Confirmation de Commande', 105, 20, {
                align: 'center'
            });
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`#${order.id} - ${new Date(order.date_created).toLocaleDateString('fr-MG')}`, 105, 30, {
                align: 'center'
            });

            // Facturation / Retrait
            let y = 50;
            doc.text('Facturation & Retrait Local:', 20, y);
            y += 10;
            doc.text(`${order.billing.first_name} ${order.billing.last_name}`, 20, y);
            y += 7;
            doc.text(order.billing.email, 20, y);
            if (order.billing.phone) {
                y += 7;
                doc.text(order.billing.phone, 20, y);
            }
            y += 7;
            doc.text(`${order.billing.address_1}, ${order.billing.postcode} ${order.billing.city}, ${order.billing.country}`, 20, y);
            y += 15;

            // Produits (tableau simple)
            doc.text('Vos Produits:', 20, y);
            y += 10;
            order.items.forEach((item, i) => {
                doc.text(`${item.name} (x${item.quantity})`, 20, y);
                doc.text(`${item.price} TTC / unité - Total: ${item.total} TTC`, 20, y + 7);
                y += 15;
            });

            // Totaux
            y += 5;
            doc.setFont('helvetica', 'bold');
            doc.text('Livraison (retrait local): 0 Ar', 20, y);
            y += 10;
            doc.setFontSize(14);
            doc.text(`Total TTC: ${order.total}`, 20, y);
            y += 15;

            // Paiement
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`Méthode de paiement: ${order.payment_method_title || order.payment_method}`, 20, y);
            if (['on-hold', 'pending'].includes(order.status)) {
                y += 10;
                doc.text('Statut: En attente (instructions par email)', 20, y);
            }

            // Télécharge
            doc.save(`commande-${orderId}.pdf`);
            console.log('[Static PDF] Généré pour #', orderId);
        } catch (e) {
            alert('Erreur génération PDF: ' + e.message + '. Essayez à nouveau.');
            console.error('[Static PDF]', e);
        }
    }
</script>

<script>
    (function() {
        const staticEl = document.getElementById('thankyou-static');
        const islandEl = document.getElementById('thankyou-island');

        if (!islandEl) return; // Pas d'island si ordre invalide

        document.addEventListener('island-mounted', function(e) {
            if (e.detail && e.detail.island === 'thankyou') {
                islandEl.style.display = 'block';
                if (staticEl) staticEl.style.display = 'none';
                console.log('[Thankyou Woo] Island mounted, static hidden');
            }
        });

        // Fallback timeout (si event manquant)
        setTimeout(function() {
            if (islandEl.innerHTML.trim() !== '' && islandEl.style.display !== 'block') {
                islandEl.style.display = 'block';
                if (staticEl) staticEl.style.display = 'none';
            }
        }, 3000); // 3s

        // Si erreur fetch (via custom event depuis React)
        document.addEventListener('island-error', function() {
            console.warn('[Thankyou Woo] Island error: Keep static visible');
            if (islandEl) islandEl.style.display = 'none'; // Cache island en erreur
        });
    })();
</script>

<?php get_footer('shop'); ?>