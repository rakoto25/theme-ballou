<?php
if (!defined('ABSPATH')) exit;

/**
 * =====================================================================
 * REST Panier (Ballou) – Corrigé pour TTC, String Keys, et Infos Complètes
 * - Cookies: ballou_cart (JSON [{"key": "123_0", "product_id":123,"qty":2}, ...]) – Nouveau: key string
 * - Routes:
 *     GET    /ballou/v1/cart/lines → Retourne items complets (comme quote) avec name/price(TTC)/images + product_id (parent)
 *     POST   /ballou/v1/cart/update     {id: string key ou number product_id, qty}
 *     POST   /ballou/v1/cart/remove     {id: string key}
 *     POST   /ballou/v1/cart/quote      {lines?, coupons?, address?, shipping_method?, fast?} – TTC partout, product_id dans items
 *     GET    /ballou/v1/cart/count
 * - Ajout: Devis "FAST" -> fast:true pour recalcul rapide (sans shipping/coupons/WC cart)
 * - Corrections:
 *   - TTC: wc_get_price_including_tax, line_total TTC (line_subtotal + line_tax)
 *   - Keys: String 'product_id_0' (simulé, car pas WC cart_item_key sans WC cart)
 *   - /lines: Retourne array items complets (name, price TTC, images, product_id=parent) → Pas besoin fetchProduct frontend
 *   - Variations: Gère default/first child pour prix/name/images
 *   - Totaux: subtotal TTC, total TTC ; discount TTC si applicable
 *   - NOUVEAU: Support 'id' dans lines_input (alias product_id) ; null checks PHP 8+ ; fallback robuste ; logs debug ; FIX: $add_line call
 *   - AMÉLIORÉ: Logs add_line précis (raison fail: stock, purchasable) ; placeholder check (file_exists) pour éviter 404
 *   - CORRIGÉ: Ajout 'product_id' (parent/simple original) dans TOUS items (/lines, quote fast/full/fallback) → TS product_id>0 sans parse key
 * =====================================================================
 */

add_action('rest_api_init', function () {

    register_rest_route('ballou/v1', '/cart/lines', [
        'methods'             => 'GET',
        'callback'            => 'ballou_cart_get_lines',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('ballou/v1', '/cart/update', [
        'methods'             => ['PATCH', 'POST'],
        'callback'            => 'ballou_cart_update_line',
        'permission_callback' => '__return_true',
        'args'                => [
            'id'  => ['required' => true],
            'qty' => ['required' => true],
        ],
    ]);

    register_rest_route('ballou/v1', '/cart/remove', [
        'methods'             => ['POST', 'DELETE'],
        'callback'            => 'ballou_cart_remove_line',
        'permission_callback' => '__return_true',
        'args'                => [
            'id' => ['required' => true],
        ],
    ]);

    register_rest_route('ballou/v1', '/cart/quote', [
        'methods'             => 'POST',
        'callback'            => 'ballou_cart_quote',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('ballou/v1', '/cart/count', [
        'methods'             => 'GET',
        'callback'            => function () {
            $lines = ballou_read_cookie_lines();
            $count = 0;
            foreach ($lines as $l) {
                $count += max(0, intval($l['qty']));
            }
            return new WP_REST_Response(['count' => $count], 200);
        },
        'permission_callback' => '__return_true',
    ]);
});

/** ========================= Helpers cookie & validation ========================= */

if (!defined('BALLOU_CART_COOKIE'))  define('BALLOU_CART_COOKIE', 'ballou_cart');
if (!defined('BALLOU_CART_MAXAGE'))  define('BALLOU_CART_MAXAGE', 604800); // 7 jours

if (!function_exists('ballou_safe_json_decode')) {
    function ballou_safe_json_decode($raw)
    {
        if (!is_string($raw)) return [];
        $clean = stripslashes($raw);
        $data  = json_decode($clean, true);
        return (json_last_error() === JSON_ERROR_NONE && is_array($data)) ? $data : [];
    }
}

if (!function_exists('ballou_coerce_lines')) {
    function ballou_coerce_lines($arr)
    {
        $out = [];
        if (!is_array($arr)) return $out;
        foreach ($arr as $it) {
            $key = isset($it['key']) ? sanitize_text_field($it['key']) : null;
            $pid_input = isset($it['product_id']) ? intval($it['product_id']) : (isset($it['id']) ? intval($it['id']) : 0); // Support 'id' alias
            $qty = isset($it['qty']) ? intval($it['qty']) : 0;
            // Valide key ou fallback 'pid_0'
            if ($key === null && $pid_input > 0) $key = $pid_input . '_0';
            if ($key && $pid_input > 0 && $qty > 0) {
                $out[] = ['key' => $key, 'product_id' => $pid_input, 'qty' => $qty];
            }
        }
        return $out;
    }
}

if (!function_exists('ballou_read_cookie_lines')) {
    function ballou_read_cookie_lines()
    {
        $raw = isset($_COOKIE[BALLOU_CART_COOKIE]) ? $_COOKIE[BALLOU_CART_COOKIE] : '[]';
        return ballou_coerce_lines(ballou_safe_json_decode($raw));
    }
}

if (!function_exists('ballou_write_cookie_lines')) {
    function ballou_write_cookie_lines($lines)
    {
        $lines = array_values(ballou_coerce_lines($lines)); // Filtre qty > 0
        $value = wp_json_encode($lines);
        $cookie_path = '/';
        setcookie(
            BALLOU_CART_COOKIE,
            $value,
            [
                'expires'  => time() + BALLOU_CART_MAXAGE,
                'path'     => $cookie_path,
                'secure'   => is_ssl(),
                'httponly' => true,
                'samesite' => 'Lax',
            ]
        );
        $_COOKIE[BALLOU_CART_COOKIE] = $value;
    }
}

/** Helper pour produits variables : sélectionne variation par défaut pour prix TTC, name, images */
if (!function_exists('ballou_get_priced_product')) {
    function ballou_get_priced_product($product_id)
    {
        $p = wc_get_product($product_id);
        if (!$p || !$p->is_purchasable()) return null;
        if (!$p->is_type('variable')) return $p;

        // Variable : default attributes
        $default_attrs = $p->get_default_attributes();
        if (!empty($default_attrs)) {
            $variation_id = wc_get_matching_product_variation($p, $default_attrs);
            if ($variation_id) return wc_get_product($variation_id);
        }

        // Sinon, première variation valide
        $children = $p->get_children();
        foreach ($children as $child_id) {
            $child = wc_get_product($child_id);
            if ($child && $child->is_purchasable() && $child->is_in_stock()) {
                return $child;
            }
        }
        return null; // Aucune variation valide
    }
}

/** Build item complet depuis product (pour /lines et fallback) – CORRIGÉ: Ajout 'product_id' (original parent/simple) */
if (!function_exists('ballou_build_item')) {
    function ballou_build_item($product_id, $qty, $cookie_key)
    {
        $pp = ballou_get_priced_product($product_id);
        if (!$pp) return null;

        $unit_price = (float) wc_get_price_including_tax($pp); // TTC
        $line_total = $unit_price * $qty; // TTC
        $max_qty = $pp->managing_stock() ? (int) $pp->get_stock_quantity() : null;
        $available = $pp->is_in_stock() && ($max_qty === null || $qty <= $max_qty);

        $images = [];
        $placeholder_path = ABSPATH . 'wp-content/uploads/placeholder.png';
        if ($img_id = $pp->get_image_id()) {
            if ($src = wp_get_attachment_image_url($img_id, 'woocommerce_thumbnail')) {
                $alt = get_post_meta($img_id, '_wp_attachment_image_alt', true) ?: $pp->get_name();
                $images[] = ['src' => $src, 'alt' => $alt];
            } elseif (file_exists($placeholder_path)) {
                $images[] = ['src' => '/wp-content/uploads/placeholder.png', 'alt' => $pp->get_name()];  // Fallback local si existe
            } // Sinon: empty array, JS gère no-image
        } elseif (file_exists($placeholder_path)) {
            $images[] = ['src' => '/wp-content/uploads/placeholder.png', 'alt' => $pp->get_name()];  // Fallback si existe
        } // Sinon: empty

        $item = [
            'id'            => $pp->get_id(),
            'key'           => $cookie_key,
            'cookie_id'     => $cookie_key, // Alias string
            'qty'           => $qty,
            'unit_price'    => $unit_price, // TTC
            'line_total'    => $line_total, // TTC
            'available'     => $available,
            'max_qty'       => $max_qty,
            'product'       => [
                'id'        => $pp->get_id(),
                'name'      => $pp->get_name(),
                'permalink' => get_permalink($pp->get_id()),
                'price'     => wc_price($unit_price), // String formaté TTC ex: "50 000 Ar"
                'images'    => $images,
            ],
            'variation_id'  => $pp->get_parent_id() ? $pp->get_id() : null, // Si variation
        ];
        $item['product_id'] = $product_id;  // CORRIGÉ: Original parent/simple ID pour TS

        return $item;
    }
}

/** ============================= Endpoints simples ============================= */

/** /lines retourne items complets (comme quote FAST) – CORRIGÉ: product_id inclus */
if (!function_exists('ballou_cart_get_lines')) {
    function ballou_cart_get_lines(WP_REST_Request $req)
    {
        $lines = ballou_read_cookie_lines();
        $items = [];
        foreach ($lines as $l) {
            $item = ballou_build_item($l['product_id'], $l['qty'], $l['key']);
            if ($item) $items[] = $item;  // product_id déjà ajouté dans build_item
        }
        if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Lines] Items returned: " . count($items) . " avec product_id");
        return new WP_REST_Response(['lines' => $items], 200); // 'lines' → items array
    }
}

if (!function_exists('ballou_cart_update_line')) {
    function ballou_cart_update_line(WP_REST_Request $req)
    {
        $json = $req->get_json_params();
        $id_input = $json['id'] ?? $req->get_param('id'); // String ou number
        $qty = intval($json['qty'] ?? $req->get_param('qty'));

        if ($qty < 0) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Bad qty'], 400);
        }

        // Parse id: string key ou number → key='pid_0'
        $product_id = 0;
        $key = null;
        if (is_numeric($id_input)) {
            $product_id = intval($id_input);
            $key = $product_id . '_0';
        } else {
            $key = sanitize_text_field($id_input);
            $parts = explode('_', $key);
            $product_id = intval($parts[0] ?? 0);
        }

        if ($product_id <= 0 || !$key) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Bad id'], 400);
        }

        $lines = ballou_read_cookie_lines();
        $found = false;

        foreach ($lines as &$l) {
            if ($l['key'] === $key) {
                $found = true;
                if ($qty === 0) {
                    // Suppression après boucle
                } else {
                    $l['qty'] = max(1, $qty);
                }
                break;
            }
        }
        unset($l);

        if ($qty === 0) {
            $lines = array_values(array_filter($lines, fn($l) => $l['key'] !== $key));
        } elseif (!$found) {
            // Vérifie produit existe avant add
            $p = wc_get_product($product_id);
            if (!$p || !$p->is_purchasable()) {
                return new WP_REST_Response(['ok' => false, 'error' => 'Produit invalide'], 400);
            }
            $lines[] = ['key' => $key, 'product_id' => $product_id, 'qty' => max(1, $qty)];
        }

        ballou_write_cookie_lines($lines);
        return new WP_REST_Response(['ok' => true, 'cart' => $lines], 200);
    }
}

if (!function_exists('ballou_cart_remove_line')) {
    function ballou_cart_remove_line(WP_REST_Request $req)
    {
        $json = $req->get_json_params();
        $id_input = $json['id'] ?? $req->get_param('id'); // String key

        $key = is_numeric($id_input) ? intval($id_input) . '_0' : sanitize_text_field($id_input);
        if (!$key) {
            return new WP_REST_Response(['ok' => false, 'error' => 'Bad id'], 400);
        }

        $lines = array_values(array_filter(ballou_read_cookie_lines(), fn($l) => $l['key'] !== $key));
        ballou_write_cookie_lines($lines);
        return new WP_REST_Response(['ok' => true, 'cart' => $lines], 200);
    }
}

/** ============================ Devis WooCommerce ============================= */

/** TTC partout ; items incluent product.name/price(TTC)/images + product_id (parent) ; keys string ; support 'id' ; null checks ; FIX $add_line */
if (!function_exists('ballou_cart_quote')) {
    function ballou_cart_quote(WP_REST_Request $req)
    {
        try {
            if (!class_exists('WooCommerce')) {
                return new WP_REST_Response(['error' => 'WooCommerce missing'], 500);
            }

            // Payload
            $payload     = $req->get_json_params() ?: [];
            $fast        = !empty($payload['fast']);
            $lines_input = isset($payload['lines']) ? $payload['lines'] : null;  // Raw input, ex. [{"id":"935","qty":1}]

            // Lignes: payload -> cookie -> [] (coerce gère 'id' maintenant)
            $lines       = ballou_coerce_lines($lines_input ?? ballou_read_cookie_lines());
            $coupons     = array_map('wc_format_coupon_code', array_values($payload['coupons'] ?? []));
            $addr        = is_array($payload['address'] ?? null) ? $payload['address'] : [];
            $ship_chosen = isset($payload['shipping_method']) ? sanitize_text_field($payload['shipping_method']) : null;

            $currency = function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'MGA';

            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log("[Quote Debug] Input raw lines: " . count($lines_input ?? []) . ", coercées: " . count($lines) . " | Ex: " . print_r($lines_input[0] ?? 'none', true));
            }

            // ============== A) FAST ==============
            if ($fast) {
                $items    = [];
                $subtotal = 0.0;

                foreach ($lines as $l) {
                    // Build key si absent
                    $key = $l['key'] ?? $l['product_id'] . '_0';
                    $item = ballou_build_item($l['product_id'], $l['qty'], $key);
                    if (!$item) {
                        if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Build item fail PID=" . $l['product_id']);
                        continue;
                    }
                    $item['product_id'] = $l['product_id'];  // CORRIGÉ: Original parent ID pour TS
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Item] product_id=" . $l['product_id'] . " added (fast)");
                    $items[] = $item;
                    $subtotal += $item['line_total']; // TTC
                }

                // Init totals tôt (comme non-fast)
                $totals = [
                    'subtotal'        => $subtotal, // TTC
                    'subtotal_ex_tax' => $subtotal, // Fallback HT si besoin, mais TTC ici
                    'discount'        => 0,         // TTC
                    'discount_ex_tax' => 0,
                    'items_tax'       => 0,
                    'shipping_total'  => 0,
                    'shipping_tax'    => 0,
                    'tax_total'       => 0,
                    'total'           => $subtotal,
                    'currency'        => $currency,
                ];

                return new WP_REST_Response([
                    'items'                     => $items,
                    'currency'                  => $currency,
                    'totals'                    => $totals,
                    'applied_coupons'           => [],
                    'shipping_methods'          => [],
                    'chosen_shipping_method'    => null,
                ], 200);
            }

            // ============== B) COMPLET ==============

            // Init totals AVANT toute logique (fix undefined)
            $totals = [
                'subtotal'        => 0.0,
                'subtotal_ex_tax' => 0.0,
                'discount'        => 0.0,
                'discount_ex_tax' => 0.0,
                'items_tax'       => 0.0,
                'shipping_total'  => 0.0,
                'shipping_tax'    => 0.0,
                'tax_total'       => 0.0,
                'total'           => 0.0,
                'currency'        => $currency,
            ];

            // 1) Session/Cart
            if (function_exists('wc_load_cart')) {
                wc_load_cart();
            }
            if (!WC()->session) {
                wc()->initialize_session();
            }

            // 2) Client/adresses
            $customer = WC()->customer ?: new WC_Customer();
            $customer->set_billing_country($addr['country']   ?? $customer->get_billing_country());
            $customer->set_billing_postcode($addr['postcode'] ?? $customer->get_billing_postcode());
            $customer->set_billing_city($addr['city']         ?? $customer->get_billing_city());
            $customer->set_billing_address($addr['address_1'] ?? $customer->get_billing_address());
            $customer->set_shipping_country($addr['country']  ?? $customer->get_shipping_country());
            $customer->set_shipping_postcode($addr['postcode'] ?? $customer->get_shipping_postcode());
            $customer->set_shipping_city($addr['city']        ?? $customer->get_shipping_city());
            $customer->set_shipping_address($addr['address_1'] ?? $customer->get_shipping_address());
            WC()->customer = $customer;

            // 3) Cart local
            $cart = new WC_Cart();
            WC()->cart = $cart;

            // 3bis) Ajout de ligne (variations) – Avec key simulée (closure locale) – AMÉLIORÉ: logs raison fail
            $add_line = function (int $product_id, int $qty, string $cookie_key) use ($cart) {
                $qty = max(1, $qty);
                $p = wc_get_product($product_id);
                if (!$p instanceof WC_Product) {
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Produit null PID=$product_id");
                    return false;
                }
                if (!$p->is_purchasable()) {
                    $reason = !$p->is_in_stock() ? 'not_in_stock' : ($p->managing_stock() ? 'stock=' . $p->get_stock_quantity() : 'out_of_stock?');
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Non purchasable PID=$product_id: $reason");
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
                        if (!$added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Add_to_cart fail variable PID=$product_id");
                        return $added;
                    }
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Variable sans variation valide PID=$product_id");
                    return false;
                }

                $added = (bool) $cart->add_to_cart($p->get_id(), $qty);
                if (!$added && defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Add_to_cart fail simple PID=$product_id");
                return $added;
            };

            // 4) Injecter les lignes (FIX: $add_line avec $)
            $added_count = 0;
            foreach ($lines as $l) {
                $key = $l['key'] ?? $l['product_id'] . '_0';
                if ($add_line($l['product_id'], $l['qty'], $key)) {  // FIX: $add_line
                    $added_count++;
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Add_line success PID=" . $l['product_id']);
                } else {
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Add_line fail PID=" . $l['product_id'] . ", qty=" . $l['qty']);
                }
            }
            if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Lignes ajoutées au cart: $added_count / " . count($lines));

            // Early fallback si rien ajouté (force calcul sans cart)
            if ($added_count === 0 && !empty($lines)) {
                if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Cart vide, force fallback");
                // Utilise build_item pour calculer totals/items
                $fallback_items = [];
                $subtotal = 0.0;
                foreach ($lines as $l) {
                    $key = $l['key'] ?? $l['product_id'] . '_0';
                    $item = ballou_build_item($l['product_id'], $l['qty'], $key);
                    if ($item) {
                        $item['product_id'] = $l['product_id'];  // CORRIGÉ: Original parent
                        if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Item] product_id=" . $l['product_id'] . " fallback");
                        $fallback_items[] = $item;
                        $subtotal += $item['line_total']; // TTC
                    }
                }
                $totals['subtotal'] = $subtotal;
                $totals['total'] = $subtotal;

                return new WP_REST_Response([
                    'items'                     => $fallback_items,
                    'currency'                  => $currency,
                    'totals'                    => $totals,
                    'applied_coupons'           => [],  // Pas de coupons si cart fail
                    'shipping_methods'          => [],
                    'chosen_shipping_method'    => null,
                ], 200);
            }

            // 5) Coupons – TTC
            $appliedCoupons = [];
            foreach ($coupons as $c) {
                $coupon = new WC_Coupon($c);
                if ($coupon->get_code() && $coupon->is_valid()) {
                    $cart->apply_coupon($coupon->get_code());
                    $appliedCoupons[] = [
                        'code'   => $coupon->get_code(),
                        'valid'  => true,
                        'amount' => wc_format_decimal($coupon->get_amount(), 2),
                        'type'   => $coupon->get_discount_type(),
                    ];
                } else {
                    $appliedCoupons[] = ['code' => $c, 'valid' => false];
                }
            }

            // 6) Totaux + shipping (safe)
            $cart->calculate_totals();

            $shipping_methods = [];
            try {
                $packages = $cart->get_shipping_packages();
                if (is_array($packages) && !empty($packages)) {
                    $rated = WC()->shipping()->calculate_shipping($packages);
                    if (is_array($rated)) {
                        foreach ($rated as $pkg) {
                            if (empty($pkg['rates'])) continue;
                            foreach ($pkg['rates'] as $rate) {
                                $taxes = $rate->get_taxes() ?? [];
                                $cost = (float) $rate->get_cost() + array_sum(array_map(fn($t) => (float) $t, $taxes));
                                $shipping_methods[] = [
                                    'id'    => $rate->get_id(),
                                    'label' => $rate->get_label(),
                                    'total' => wc_round_tax_total($cost), // TTC
                                ];
                            }
                        }
                    }
                }
            } catch (Throwable $e) {
                if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Shipping Error] " . $e->getMessage());
            }
            $chosen   = $ship_chosen ?: ($shipping_methods[0]['id'] ?? null);

            // 7) Items – TTC, complets (null checks) – CORRIGÉ: product_id=parent ; AMÉLIORÉ: placeholder check
            $items = [];
            $placeholder_path = ABSPATH . 'wp-content/uploads/placeholder.png';
            foreach ($cart->get_cart() as $ci_key => $ci) {
                if (!is_array($ci) || empty($ci)) {
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Cart item null at key=$ci_key");
                    continue;  // Fix: skip null
                }
                /** @var WC_Product $pp */
                $pp = $ci['data'] ?? null;
                if (!$pp || !($pp instanceof WC_Product)) {
                    if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Data null/invalide at key=$ci_key");
                    continue;  // Fix: skip null pp
                }
                $pid   = $pp->get_id();
                $qty   = (int) ($ci['quantity'] ?? 0);
                if ($qty <= 0) continue;
                $unit  = (float) wc_get_price_including_tax($pp); // TTC
                $line_sub = (float) ($ci['line_subtotal'] ?? 0);
                $line_sub_tax = (float) ($ci['line_subtotal_tax'] ?? 0);
                $lineT = $line_sub + $line_sub_tax;  // TTC, fix null offset
                $maxQ  = $pp->managing_stock() ? (int) $pp->get_stock_quantity() : null;
                $avail = $pp->is_in_stock() && ($maxQ === null || $qty <= $maxQ);

                $images = [];
                if ($img_id = $pp->get_image_id()) {
                    if ($src = wp_get_attachment_image_url($img_id, 'woocommerce_thumbnail')) {
                        $alt = get_post_meta($img_id, '_wp_attachment_image_alt', true) ?: $pp->get_name();
                        $images[] = ['src' => $src, 'alt' => $alt];
                    } elseif (file_exists($placeholder_path)) {
                        $images[] = ['src' => '/wp-content/uploads/placeholder.png', 'alt' => $pp->get_name()];  // Fallback local si existe
                    } // Sinon: empty
                } elseif (file_exists($placeholder_path)) {
                    $images[] = ['src' => '/wp-content/uploads/placeholder.png', 'alt' => $pp->get_name()];  // Fallback si existe
                } // Sinon: empty

                // key = ci_key (WC génère string) ou fallback (safe)
                $cookie_key = $ci_key ?: ($lines[array_search($pid, array_column($lines, 'product_id')) ?? 0]['key'] ?? $pid . '_0');

                $original_pid = $pp->get_parent_id() ? $pp->get_parent_id() : $pid;  // CORRIGÉ: Parent pour TS
                $item = [
                    'id'            => $pid,
                    'key'           => $cookie_key, // String
                    'cookie_id'     => $cookie_key,
                    'qty'           => $qty,
                    'unit_price'    => $unit, // TTC
                    'line_total'    => $lineT, // TTC
                    'available'     => (bool) $avail,
                    'max_qty'       => $maxQ,
                    'product'       => [
                        'id'        => $pid,
                        'name'      => $pp->get_name(),
                        'permalink' => get_permalink($pid),
                        'price'     => wc_price($unit), // String TTC formaté
                        'images'    => $images,
                    ],
                    'variation_id'  => $pp->get_parent_id() ? $pp->get_id() : null,
                ];
                $item['product_id'] = $original_pid;  // CORRIGÉ: Original parent/simple
                if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Item] product_id=$original_pid added (full)");
                $items[] = $item;
            }

            // 8) Fallback si cart vide mais input valide – Utilise build_item sur raw si needed – CORRIGÉ: product_id
            if (empty($items) && !empty($lines_input)) {
                $fallback_items = [];
                $subtotal = 0.0;
                // Essai coerce d'abord
                foreach ($lines as $l) {
                    $key = $l['key'] ?? $l['product_id'] . '_0';
                    $item = ballou_build_item($l['product_id'], $l['qty'], $key);
                    if ($item) {
                        $item['product_id'] = $l['product_id'];  // CORRIGÉ: Original
                        if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Item] product_id=" . $l['product_id'] . " fallback coerce");
                        $fallback_items[] = $item;
                        $subtotal += $item['line_total']; // TTC
                    }
                }
                // Si encore vide, essai direct sur raw (sans coerce, pour cas edge)
                if (empty($fallback_items) && is_array($lines_input)) {
                    foreach ($lines_input as $raw_line) {
                        $pid = intval($raw_line['id'] ?? $raw_line['product_id'] ?? 0);
                        $qty = intval($raw_line['qty'] ?? 0);
                        if ($pid > 0 && $qty > 0) {
                            $key = $pid . '_0';
                            $item = ballou_build_item($pid, $qty, $key);
                            if ($item) {
                                $item['product_id'] = $pid;  // CORRIGÉ: Raw pid (parent)
                                if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Item] product_id=$pid fallback raw");
                                $fallback_items[] = $item;
                                $subtotal += $item['line_total'];
                            }
                        }
                    }
                }

                $totals['subtotal'] = $subtotal;
                $totals['total'] = $subtotal;  // Update totals

                if (defined('WP_DEBUG') && WP_DEBUG) error_log("[Quote Debug] Fallback activé: items=" . count($fallback_items) . " avec product_id");

                return new WP_REST_Response([
                    'items'                     => $fallback_items,
                    'currency'                  => $currency,
                    'totals'                    => $totals,
                    'applied_coupons'           => $appliedCoupons,
                    'shipping_methods'          => [],
                    'chosen_shipping_method'    => null,
                ], 200);
            }

            // 9) Totaux complets – TTC (safe null)
            $subtotal_ex = (float) ($cart->get_subtotal() ?? 0);
            $subtotal_tax = (float) ($cart->get_subtotal_tax() ?? 0);
            $subtotal_ttc = $subtotal_ex + $subtotal_tax;
            $discount_total = (float) ($cart->get_discount_total() ?? 0);
            $discount_tax = (float) ($cart->get_discount_tax() ?? 0);
            $discount_ttc = $discount_total + $discount_tax;
            $shipping_total = (float) ($cart->get_shipping_total() ?? 0);
            $shipping_tax = (float) ($cart->get_shipping_tax() ?? 0);
            $total_tax = (float) ($cart->get_total_tax() ?? 0);
            $cart_total = (float) ($cart->get_total('edit') ?? 0);

            $totals['subtotal'] = $subtotal_ttc;
            $totals['subtotal_ex_tax'] = $subtotal_ex;
            $totals['discount'] = $discount_ttc;
            $totals['discount_ex_tax'] = $discount_total;
            $totals['items_tax'] = (float) ($cart->get_cart_contents_tax() ?? 0);
            $totals['shipping_total'] = $shipping_total + $shipping_tax;
            $totals['shipping_tax'] = $shipping_tax;
            $totals['tax_total'] = $total_tax;
            $totals['total'] = $cart_total ?: ($subtotal_ttc - $discount_ttc + $totals['shipping_total']);  // Fallback safe

            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log("[Quote Final] Items: " . count($items) . " | Subtotal TTC: " . $totals['subtotal'] . " | Total TTC: " . $totals['total'] . " avec product_id");
            }

            return new WP_REST_Response([
                'items'                     => $items,
                'currency'                  => $currency,
                'totals'                    => $totals,
                'applied_coupons'           => $appliedCoupons,
                'shipping_methods'          => $shipping_methods,
                'chosen_shipping_method'    => $chosen,
            ], 200);
        } catch (Throwable $e) {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log("[Quote Fatal] " . $e->getMessage() . " | Payload: " . print_r($payload, true));
            }
            return new WP_REST_Response(['error' => 'internal_error'], 500);
        }
    }
}
