<?php

/**
 * REST API endpoint pour la page de remerciement WooCommerce (sans shipping, offline).
 * Endpoint: /wp-json/wc/v3/merci/{order_id}?key={clé}
 * Création: /wp-json/ballou/v1/checkout (POST) → Redirect /checkout/order-received/
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('WooCommerce')) {
    error_log('[Ballou API] WooCommerce non actif.');
    wp_die('WooCommerce n\'est pas actif.');
}

add_action('rest_api_init', function () {
    error_log('[Ballou API] Enregistrement routes REST.');
    register_rest_route('wc/v3', '/merci/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'get_order_details_for_thankyou',
        'permission_callback' => '__return_true', // Public (clé sécurise)
        'args' => array(
            'id' => array(
                'validate_callback' => function ($param) {
                    return is_numeric($param) && $param > 0;
                }
            )
        )
    ));

    register_rest_route('ballou/v1', '/checkout', array(
        'methods' => 'POST',
        'callback' => 'handle_create_order',
        'permission_callback' => 'ballou_check_nonce',
        'args' => array(
            'lines' => array('required' => true, 'validate_callback' => 'is_array'),
            'billing' => array('required' => true, 'validate_callback' => 'is_array'),
            'payment_method' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
            'coupons' => array('default' => array(), 'validate_callback' => 'is_array'),
            'note' => array('default' => '', 'sanitize_callback' => 'sanitize_textarea_field'),
            'taxes' => array('default' => array(), 'validate_callback' => 'is_array'),
        )
    ));
});

// Flush rewrite à l'activation (si besoin)
add_action('init', function () {
    if (get_option('ballou_flush_rewrite')) {
        flush_rewrite_rules();
        delete_option('ballou_flush_rewrite');
    }
});

function get_order_details_for_thankyou($request)
{
    $order_id = intval($request['id']);
    error_log('[Ballou API] Endpoint /merci/' . $order_id . ' hit (key: ' . ($_GET['key'] ?? 'none') . ')');

    $order = wc_get_order($order_id);

    if (!$order) {
        error_log('[Ballou API] Ordre ' . $order_id . ' non trouvé (404).');
        return new WP_Error('no_order', 'Commande non trouvée.', array('status' => 404));
    }

    $provided_key = isset($_GET['key']) ? sanitize_text_field($_GET['key']) : '';
    if ($provided_key && $order->get_order_key() !== $provided_key) {
        error_log('[Ballou API] Clé invalide pour ordre ' . $order_id . ' (403).');
        return new WP_Error('invalid_key', 'Accès refusé : clé de commande invalide.', array('status' => 403));
    }

    $order_data = array(
        'id' => $order->get_id(),
        'status' => $order->get_status(),
        'total' => $order->get_total(), // String TTC
        'currency' => $order->get_currency(),
        'date_created' => $order->get_date_created()->format('Y-m-d H:i:s'),
        'billing' => array(
            'first_name' => $order->get_billing_first_name(),
            'last_name' => $order->get_billing_last_name(),
            'email' => $order->get_billing_email(),
            'phone' => $order->get_billing_phone(),
            'address_1' => $order->get_billing_address_1(),
            'address_2' => $order->get_billing_address_2(),
            'city' => $order->get_billing_city(),
            'state' => $order->get_billing_state(),
            'postcode' => $order->get_billing_postcode(),
            'country' => $order->get_billing_country(),
        ),
        'items' => array(),
        'shipping_lines' => array(), // Vide (retrait local)
        'payment_method' => $order->get_payment_method(),
        'payment_method_title' => $order->get_payment_method_title(),
    );

    foreach ($order->get_items() as $item) {
        $order_data['items'][] = array(
            'name' => $item->get_name(),
            'quantity' => $item->get_quantity(),
            'total' => $item->get_total(), // TTC
            'price' => wc_format_decimal($item->get_total() / $item->get_quantity(), 2), // Unit TTC
        );
    }

    error_log('[Ballou API] Détails ordre ' . $order_id . ' renvoyés (status: ' . $order->get_status() . ').');
    return rest_ensure_response($order_data);
}

function handle_create_order($request)
{
    error_log('[Ballou API] Création ordre via POST (lines: ' . count($request['lines']) . ')');

    if (WC()->cart->is_empty()) {
        error_log('[Ballou API] Panier vide (400).');
        return new WP_Error('empty_cart', 'Panier vide.', array('status' => 400));
    }

    $order = wc_create_order();
    if (is_wp_error($order)) {
        error_log('[Ballou API] Échec création ordre: ' . $order->get_error_message());
        return $order;
    }

    foreach ($request['lines'] as $line) {
        $product_id = intval($line['product_id'] ?? 0);
        $variation_id = intval($line['variation_id'] ?? 0);
        $qty = intval($line['qty'] ?? 1);
        if ($product_id > 0 && $qty > 0) {
            $product = wc_get_product($variation_id ?: $product_id);
            if ($product) {
                $order->add_product($product, $qty);
            } else {
                error_log('[Ballou API] Produit ' . $product_id . ' introuvable.');
            }
        }
    }

    // Billing = shipping (retrait local)
    $order->set_address($request['billing'], 'billing');
    $order->set_address($request['billing'], 'shipping');

    $order->set_payment_method($request['payment_method']);

    foreach ($request['coupons'] as $coupon_code) {
        $order->apply_coupon(sanitize_text_field($coupon_code));
    }

    if (!empty($request['note'])) {
        $order->set_customer_note($request['note']);
    }

    // Calcule (taxes, coupons, shipping=0)
    $order->calculate_taxes();
    $order->calculate_totals();

    // 'on-hold' pour offline → /order-received/ (pas /order-pay/)
    $order->update_status('on-hold', 'Commande API, paiement offline/retrait local.');

    $order->save();

    // Hooks Woo (emails)
    $data = array(
        'order_id' => $order->get_id(),
        'billing' => $request['billing'],
        'payment_method' => $request['payment_method'],
    );
    do_action('woocommerce_checkout_order_processed', $order, $data);

    // Force emails si manquants
    if (class_exists('WC_Email')) {
        WC()->mailer()->emails['WC_Email_Customer_Processing_Order']->trigger($order->get_id());
        WC()->mailer()->emails['WC_Email_New_Order']->trigger($order->get_id());
    }

    error_log('[Ballou API] Ordre #' . $order->get_id() . ' créé (on-hold, total: ' . $order->get_total() . ', key: ' . $order->get_order_key() . ')');

    $thankyou_url = wc_get_checkout_url() . "order-received/{$order->get_id()}/?key=" . $order->get_order_key();

    WC()->cart->empty_cart();

    return rest_ensure_response(array(
        'order_id' => $order->get_id(),
        'order_key' => $order->get_order_key(),
        'payment_url' => $thankyou_url,
    ));
}

function ballou_check_nonce()
{
    $nonce = $_REQUEST['_wpnonce'] ?? $_SERVER['HTTP_X_WP_NONCE'] ?? '';
    $valid = wp_verify_nonce($nonce, 'wp_rest') || current_user_can('manage_woocommerce');
    if (!$valid) error_log('[Ballou API] Nonce invalide pour /checkout.');
    return $valid;
}
