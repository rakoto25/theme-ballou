<?php
if (!defined('ABSPATH')) exit;

/**
 * =====================================================================
 * REST Checkout (Ballou) – Options Shipping/Payment + Création Ordre
 * - Routes:
 *   GET  /ballou/v1/checkout/options?country=MG&postcode=101&...&lines=935:1 → Shipping methods, payment gateways, taxes TTC, lines (items qty=1)
 *   POST /ballou/v1/checkout {lines: [...], address: {...}, totals: {...}, payment_method: 'bacs'} → Crée ordre Woo, retourne payment_url
 * - Corrections:
 *   - Parse lines= "PID:QTY" string (de URL query) ou array JSON payload.
 *   - TTC: Utilise WC cart temp pour calculs shipping/taxes ; fallback build_item si add fail.
 *   - Qty: Respecte qty ajoutée (1=1 pièce, pas stock=8) ; gère variations comme cart (default/first child).
 *   - Madagascar: Support pays WC, zones shipping (configurez Admin > Woo > Shipping Zones > Ajouter Madagascar).
 *   - Null checks PHP 8+ ; try-catch ; logs debug pour 500 ; retourne 'lines' pour UI cohérente.
 *   - Payment: Gateways actifs (ex. : BACS pour test, Stripe si plugin).
 * =====================================================================
 */

add_action('rest_api_init', function () {

    register_rest_route('ballou/v1', '/checkout/options', [
        'methods'             => 'GET',
        'callback'            => 'ballou_checkout_get_options',
        'permission_callback' => '__return_true',
        'args'                => [
            'country'   => ['required' => false, 'default' => 'MG'],
            'postcode'  => ['required' => false, 'default' => '101'],
            'city'      => ['required' => false, 'default' => 'Antananarivo'],
            'address_1' => ['required' => false, 'default' => ''],
            'address_2' => ['required' => false, 'default' => ''],
            'state'     => ['required' => false, 'default' => ''],
            'lines'     => ['required' => false, 'default' => ''],  // "935:1,936:2"
        ],
    ]);

    register_rest_route('ballou/v1', '/checkout', [
        'methods'             => 'POST',
        'callback'            => 'ballou_checkout_create_order',
        'permission_callback' => '__return_true',
    ]);
});

/** Parse lines string "PID:QTY,..." → array [pid => qty] pour add_to_cart */
if (!function_exists('ballou_parse_lines_query')) {
    function ballou_parse_lines_query($lines_str)
    {
        if (empty($lines_str)) return [];
        $parsed = [];
        $pairs = explode(',', $lines_str);
        foreach ($pairs as $pair) {
            [$pid_str, $qty_str] = explode(':', trim($pair), 2);
            $pid = intval($pid_str);
            $qty = max(1, intval($qty_str ?? 1));
            if ($pid > 0) $parsed[$pid] = $qty;
        }
        if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Debug] Lines parsed: " . print_r($parsed, true));
        return $parsed;
    }
}

/** Build item pour fallback (copié de rest_cart.php) */
if (!function_exists('ballou_build_item')) {
    function ballou_build_item($product_id, $qty, $cookie_key = null)
    {
        $p = wc_get_product($product_id);
        if (!$p || !$p->is_purchasable()) return null;
        if ($p->is_type('variable')) {
            $default_attrs = $p->get_default_attributes();
            if (!empty($default_attrs)) {
                $variation_id = wc_get_matching_product_variation($p, $default_attrs);
                if ($variation_id) $p = wc_get_product($variation_id);
            } else {
                $children = $p->get_children();
                foreach ($children as $child_id) {
                    $child = wc_get_product($child_id);
                    if ($child && $child->is_purchasable() && $child->is_in_stock()) {
                        $p = $child;
                        break;
                    }
                }
            }
            if (!$p || !$p->is_purchasable()) return null;
        }

        $unit_price = (float) wc_get_price_including_tax($p); // TTC
        $line_total = $unit_price * $qty; // TTC par qty ajoutée
        $max_qty = $p->managing_stock() ? (int) $p->get_stock_quantity() : null;
        $available = $p->is_in_stock() && ($max_qty === null || $qty <= $max_qty);

        $images = [];
        $placeholder_path = ABSPATH . 'wp-content/uploads/placeholder.png';
        if ($img_id = $p->get_image_id()) {
            if ($src = wp_get_attachment_image_url($img_id, 'woocommerce_thumbnail')) {
                $alt = get_post_meta($img_id, '_wp_attachment_image_alt', true) ?: $p->get_name();
                $images[] = ['src' => $src, 'alt' => $alt];
            } elseif (file_exists($placeholder_path)) {
                $images[] = ['src' => '/wp-content/uploads/placeholder.png', 'alt' => $p->get_name()];
            }
        } elseif (file_exists($placeholder_path)) {
            $images[] = ['src' => '/wp-content/uploads/placeholder.png', 'alt' => $p->get_name()];
        }

        return [
            'id'            => $p->get_id(),
            'key'           => $cookie_key ?? $product_id . '_0',
            'cookie_id'     => $cookie_key ?? $product_id . '_0',
            'qty'           => $qty,  // Qty ajoutée (1, pas stock)
            'unit_price'    => $unit_price, // TTC
            'line_total'    => $line_total, // TTC × qty=1
            'available'     => $available,
            'max_qty'       => $max_qty,
            'product'       => [
                'id'        => $p->get_id(),
                'name'      => $p->get_name(),
                'permalink' => get_permalink($p->get_id()),
                'price'     => wc_price($unit_price),
                'images'    => $images,
            ],
            'variation_id'  => $p->get_parent_id() ? $p->get_id() : null,
        ];
    }
}

/** ============================== Options GET ============================== */

/** CORRIGÉ: Shipping + Payment + Taxes pour address/lines ; gère variations/qty=1 ; fallback items */
if (!function_exists('ballou_checkout_get_options')) {
    function ballou_checkout_get_options(WP_REST_Request $req)
    {
        try {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['error' => 'WooCommerce missing'], 500);
            }

            // Params
            $country = sanitize_text_field($req->get_param('country') ?: 'MG');
            $postcode = sanitize_text_field($req->get_param('postcode') ?: '101');
            $city = sanitize_text_field($req->get_param('city') ?: 'Antananarivo');
            $address_1 = sanitize_text_field($req->get_param('address_1') ?: '');
            $address_2 = sanitize_text_field($req->get_param('address_2') ?: '');
            $state = sanitize_text_field($req->get_param('state') ?: '');
            $lines_str = sanitize_text_field($req->get_param('lines') ?: '');
            $lines_parsed = ballou_parse_lines_query($lines_str);  // ex. [935 => 1]

            $currency = get_woocommerce_currency() ?: 'MGA';

            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log("[Options Debug] Params: country=$country, lines_str=$lines_str, parsed=" . count($lines_parsed));
            }

            if (empty($lines_parsed)) {
                return new WP_REST_Response(['error' => 'No lines provided'], 400);
            }

            // Session/Cart temp (comme quote)
            if (function_exists('wc_load_cart')) wc_load_cart();
            if (!WC()->session) wc()->initialize_session();

            // Customer/address
            $customer = WC()->customer ?: new WC_Customer();
            $customer->set_billing_country($country);
            $customer->set_billing_postcode($postcode);
            $customer->set_billing_city($city);
            $customer->set_billing_address_1($address_1);
            $customer->set_billing_address_2($address_2);
            $customer->set_billing_state($state);
            $customer->set_shipping_country($country);
            $customer->set_shipping_postcode($postcode);
            $customer->set_shipping_city($city);
            $customer->set_shipping_address_1($address_1);
            $customer->set_shipping_address_2($address_2);
            $customer->set_shipping_state($state);
            WC()->customer = $customer;

            // Cart local
            $cart = new WC_Cart();
            WC()->cart = $cart;

            // Ajout de ligne (comme cart: gère variations, qty ajoutée=1 ; logs)
            $add_line = function (int $product_id, int $qty) use ($cart) {
                $p = wc_get_product($product_id);
                if (!$p instanceof WC_Product) {
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Debug] Produit null PID=$product_id");
                    return false;
                }
                if (!$p->is_purchasable()) {
                    $reason = !$p->is_in_stock() ? 'not_in_stock' : ($p->managing_stock() ? 'stock=' . $p->get_stock_quantity() : 'out_of_stock?');
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Debug] Non purchasable PID=$product_id: $reason");
                    return false;
                }

                $variation_id = 0;
                $variation = [];

                if ($p->is_type('variable')) {
                    $default_attrs = $p->get_default_attributes();
                    if (!empty($default_attrs)) {
                        $variation_id = wc_get_matching_product_variation($p, $default_attrs);
                        $variation = $default_attrs;
                    }

                    if (!$variation_id) {
                        $children = $p->get_children();
                        foreach ($children as $child_id) {
                            $child = wc_get_product($child_id);
                            if ($child && $child->is_purchasable() && $child->is_in_stock()) {
                                $variation_id = $child->get_id();
                                $variation = [];
                                foreach ($child->get_attributes() as $tax => $val) {
                                    $attr_key = taxonomy_is_product_attribute($tax) ? $tax : 'attribute_' . sanitize_title($tax);
                                    $variation[$attr_key] = $val;
                                }
                                break;
                            }
                        }
                    }

                    if ($variation_id) {
                        $added = (bool) $cart->add_to_cart($p->get_id(), $qty, $variation_id, $variation);
                        if ($added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Add] PID=$product_id qty=$qty success variation_id=$variation_id");
                        elseif (!$added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Add] Add_to_cart fail variable PID=$product_id qty=$qty");
                        return $added;
                    }
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Debug] Variable sans variation valide PID=$product_id");
                    return false;
                }

                $added = (bool) $cart->add_to_cart($p->get_id(), $qty);
                if ($added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Add] PID=$product_id qty=$qty success simple");
                elseif (!$added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Add] Add_to_cart fail simple PID=$product_id qty=$qty");
                return $added;
            };

            // Add lines (qty=1 respectée ; variations gérées)
            $added_count = 0;
            foreach ($lines_parsed as $pid => $qty) {
                if ($add_line($pid, $qty)) {
                    $added_count++;
                } else {
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Debug] Skip PID=$pid qty=$qty");
                }
            }

            if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Debug] Added lines: $added_count / " . count($lines_parsed));

            // Fallback si add fail (ex. : variable sans child) : build_item pour items/totals (qty=1)
            $items = [];
            $subtotal_ttc = 0.0;
            if ($added_count === 0 && !empty($lines_parsed)) {
                if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Debug] Cart empty, force fallback");
                foreach ($lines_parsed as $pid => $qty) {
                    $key = $pid . '_0';
                    $item = ballou_build_item($pid, $qty, $key);
                    if ($item) {
                        $items[] = $item;
                        $subtotal_ttc += $item['line_total'];  // TTC × qty=1
                    }
                }
                $tax_total = 0.0;  // Pas de taxes sans cart ; ajustez si besoin
            } else {
                // Normal: extract items de cart (qty ajoutée)
                foreach ($cart->get_cart() as $ci_key => $ci) {
                    if (!is_array($ci) || empty($ci)) continue;
                    $pp = $ci['data'] ?? null;
                    if (!$pp || !($pp instanceof WC_Product)) continue;
                    $pid = $pp->get_id();
                    $qty_ci = (int) ($ci['quantity'] ?? 0);
                    if ($qty_ci <= 0) continue;
                    $unit = (float) wc_get_price_including_tax($pp);
                    $line_sub = (float) ($ci['line_subtotal'] ?? 0);
                    $line_sub_tax = (float) ($ci['line_subtotal_tax'] ?? 0);
                    $line_total = $line_sub + $line_sub_tax;  // TTC × qty=1
                    $maxQ = $pp->managing_stock() ? (int) $pp->get_stock_quantity() : null;
                    $avail = $pp->is_in_stock() && ($maxQ === null || $qty_ci <= $maxQ);

                    $images = [];
                    $placeholder_path = ABSPATH . 'wp-content/uploads/placeholder.png';
                    if ($img_id = $pp->get_image_id()) {
                        if ($src = wp_get_attachment_image_url($img_id, 'woocommerce_thumbnail')) {
                            $alt = get_post_meta($img_id, '_wp_attachment_image_alt', true) ?: $pp->get_name();
                            $images[] = ['src' => $src, 'alt' => $alt];
                        } elseif (file_exists($placeholder_path)) {
                            $images[] = ['src' => '/wp-content/uploads/placeholder.png', 'alt' => $pp->get_name()];
                        }
                    } elseif (file_exists($placeholder_path)) {
                        $images[] = ['src' => '/wp-content/uploads/placeholder.png', 'alt' => $pp->get_name()];
                    }

                    $items[] = [
                        'id'            => $pid,
                        'key'           => $ci_key,
                        'cookie_id'     => $ci_key,
                        'qty'           => $qty_ci,  // Qty=1
                        'unit_price'    => $unit,
                        'line_total'    => $line_total,
                        'available'     => (bool) $avail,
                        'max_qty'       => $maxQ,
                        'product'       => [
                            'id'        => $pid,
                            'name'      => $pp->get_name(),
                            'permalink' => get_permalink($pid),
                            'price'     => wc_price($unit),
                            'images'    => $images,
                        ],
                        'variation_id'  => $pp->get_parent_id() ? $pp->get_id() : null,
                    ];
                }
                $subtotal_ttc = (float) ($cart->get_subtotal() + $cart->get_subtotal_tax());
                $tax_total = (float) $cart->get_total_tax();
            }

            if (empty($items)) {
                return new WP_REST_Response(['error' => 'No valid lines'], 400);
            }

            // Calculate totals/shipping/taxes (si cart non empty)
            $cart->calculate_totals();
            if ($added_count > 0) {
                $total = (float) $cart->get_total('edit');
                $shipping_total = 0.0;
            } else {
                $total = $subtotal_ttc;  // Fallback sans shipping
                $shipping_total = 0.0;
            }

            // Shipping methods (safe, si cart)
            $shipping_methods = [];
            if ($added_count > 0) {
                try {
                    $packages = $cart->get_shipping_packages();
                    if (!empty($packages)) {
                        $rated = WC()->shipping()->calculate_shipping($packages);
                        if (is_array($rated)) {
                            foreach ($rated as $pkg) {
                                if (!empty($pkg['rates'])) {
                                    foreach ($pkg['rates'] as $rate) {
                                        $taxes = $rate->get_taxes() ?? [];
                                        $cost = (float) $rate->get_cost() + array_sum(array_map(fn($t) => (float) $t, $taxes));
                                        $shipping_methods[] = [
                                            'id'    => $rate->get_id(),
                                            'label' => $rate->get_label(),
                                            'total' => wc_format_decimal($cost, wc_get_price_decimals()),  // TTC
                                        ];
                                    }
                                }
                            }
                        }
                    }
                    $shipping_total = (float) ($shipping_methods[0]['total'] ?? 0);
                } catch (Throwable $e) {
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Options Shipping Error] " . $e->getMessage());
                }
            }

            // Payment gateways (actifs)
            $payment_gateways = [];
            $available_gateways = WC()->payment_gateways()->get_available_payment_gateways();
            foreach ($available_gateways as $id => $gateway) {
                $payment_gateways[] = [
                    'id'          => $id,
                    'title'       => $gateway->get_title(),
                    'description' => $gateway->get_description(),
                    'icon'        => $gateway->get_icon(),
                ];
            }

            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log("[Options Final] Items: " . count($items) . ", Shipping: " . count($shipping_methods) . ", Subtotal TTC: $subtotal_ttc, Total: $total");
            }

            return new WP_REST_Response([
                'currency'          => $currency,
                'lines'             => $items,  // Qty=1, pour UI
                'shipping_methods'  => $shipping_methods,
                'payment_gateways'  => $payment_gateways,
                'totals'            => [
                    'subtotal'    => wc_format_decimal($subtotal_ttc, wc_get_price_decimals()),  // × qty=1
                    'tax'         => wc_format_decimal($tax_total, wc_get_price_decimals()),
                    'shipping'    => wc_format_decimal($shipping_total, wc_get_price_decimals()),
                    'total'       => wc_format_decimal($total, wc_get_price_decimals()),
                ],
            ], 200);
        } catch (Throwable $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log("[Options Fatal] " . $e->getMessage() . " | Params: " . print_r($req->get_params(), true));
            }
            return new WP_REST_Response(['error' => 'Options calculation failed'], 500);
        }
    }
}

/** ============================== Checkout POST ============================== */

/** Crée ordre Woo depuis quote/options ; gère variations/qty=1 */
if (!function_exists('ballou_checkout_create_order')) {
    function ballou_checkout_create_order(WP_REST_Request $req)
    {
        try {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['error' => 'WooCommerce missing'], 500);
            }

            $payload = $req->get_json_params() ?: [];
            $lines = $payload['lines'] ?? [];  // Array items de quote (qty=1)
            $address = $payload['address'] ?? [];
            $totals = $payload['totals'] ?? [];
            $payment_method = sanitize_text_field($payload['payment_method'] ?? 'bacs');  // Default BACS

            if (empty($lines) || empty($address)) {
                return new WP_REST_Response(['error' => 'Missing lines or address'], 400);
            }

            // Cart temp pour ordre
            wc_load_cart();
            $cart = WC()->cart ?: new WC_Cart();
            WC()->cart = $cart;
            $cart->empty_cart();  // Clean

            // Ajout de ligne (amélioré: variations via payload ou default ; logs)
            $add_line = function (array $line) use ($cart) {
                $pid = intval($line['id'] ?? $line['product_id'] ?? 0);
                $qty = intval($line['qty'] ?? 0);
                if ($pid <= 0 || $qty <= 0) return false;

                $p = wc_get_product($pid);
                if (!$p || !$p->is_purchasable()) {
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Order Add] Non purchasable PID=$pid qty=$qty");
                    return false;
                }

                $variation_id = intval($line['variation_id'] ?? 0);
                if ($p->is_type('variable')) {
                    if (!$variation_id) {
                        // Default comme options
                        $default_attrs = $p->get_default_attributes();
                        if (!empty($default_attrs)) {
                            $variation_id = wc_get_matching_product_variation($p, $default_attrs);
                        }
                        if (!$variation_id) {
                            $children = $p->get_children();
                            foreach ($children as $child_id) {
                                $child = wc_get_product($child_id);
                                if ($child && $child->is_purchasable() && $child->is_in_stock()) {
                                    $variation_id = $child_id;
                                    break;
                                }
                            }
                        }
                    }
                    if ($variation_id) {
                        $added = (bool) $cart->add_to_cart($pid, $qty, $variation_id);
                        if ($added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Order Add] PID=$pid qty=$qty success variation_id=$variation_id");
                        elseif (!$added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Order Add] Add_to_cart fail variable PID=$pid qty=$qty");
                        return $added;
                    }
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Order Add] Pas de variation PID=$pid qty=$qty");
                    return false;
                }

                $added = (bool) $cart->add_to_cart($pid, $qty);
                if ($added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Order Add] PID=$pid qty=$qty success simple");
                elseif (!$added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Order Add] Add_to_cart fail simple PID=$pid qty=$qty");
                return $added;
            };

            // Add lines
            $added_count = 0;
            foreach ($lines as $line) {
                if ($add_line($line)) {
                    $added_count++;
                }
            }

            if ($added_count === 0) {
                return new WP_REST_Response(['error' => 'No valid items in cart'], 400);
            }

            $cart->calculate_totals();

            // Create order
            $order = wc_create_order();
            $order->set_customer_id(get_current_user_id());  // Si logged

            // Address
            $order->set_address([
                'first_name' => $address['first_name'] ?? '',
                'last_name'  => $address['last_name'] ?? '',
                'company'    => $address['company'] ?? '',
                'email'      => $address['email'] ?? '',
                'phone'      => $address['phone'] ?? '',
                'address_1'  => $address['address_1'] ?? '',
                'address_2'  => $address['address_2'] ?? '',
                'city'       => $address['city'] ?? '',
                'state'      => $address['state'] ?? '',
                'postcode'   => $address['postcode'] ?? '',
                'country'    => $address['country'] ?? 'MG',
            ], 'billing');

            $order->set_address($order->get_address('billing'), 'shipping');  // Même pour shipping

            // Add items (qty=1 respectée)
            foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
                $order->add_product($cart_item['data'], $cart_item['quantity']);  // quantity=1
            }

            // Totals from payload/cart (TTC, × qty=1)
            $order->set_cart_tax($totals['tax'] ?? $cart->get_cart_tax());
            $order->set_shipping_total($totals['shipping'] ?? $cart->get_shipping_total());
            $order->set_discount_total($totals['discount'] ?? 0);

            $order->set_payment_method($payment_method);
            $order->calculate_totals();
            $order->update_status('pending', 'Commande via API Ballou Checkout');

            // Empty cart post-order
            $cart->empty_cart();

            $payment_url = $order->get_checkout_payment_url(true);  // /checkout/order-pay/ID/?key=...&pay_for_order=true

            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log("[Checkout Order] Created ID=" . $order->get_id() . ", Total TTC: " . $order->get_total() . ", Payment URL: $payment_url");
            }

            return new WP_REST_Response([
                'ok'          => true,
                'order_id'    => $order->get_id(),
                'order_key'   => $order->get_order_key(),
                'total'       => $order->get_total(),
                'payment_url' => $payment_url,
                'merci_url'   => home_url('/merci/?key=' . $order->get_order_key()),
            ], 200);
        } catch (Throwable $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log("[Checkout Fatal] " . $e->getMessage() . " | Payload: " . print_r($payload, true));
            }
            return new WP_REST_Response(['error' => 'Order creation failed'], 500);
        }
    }
}
