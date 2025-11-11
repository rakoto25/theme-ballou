<?php

/**
 * Ballou – Account API (Theme include)
 * Routes:
 *  GET  /wp-json/ballou/v1/account/orders     -> Liste des commandes (paginée)
 *  GET  /wp-json/ballou/v1/account/me         -> Infos profil + adresses
 *  POST /wp-json/ballou/v1/account/me         -> MAJ profil + adresses (+ mot de passe)
 */

if (!defined('ABSPATH')) exit;

/** ─────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────── */
if (!function_exists('ballou_rest_require_login')) {
    function ballou_rest_require_login()
    {
        if (!is_user_logged_in()) {
            return new WP_Error('ballou_forbidden', 'Authentification requise.', ['status' => 401]);
        }
        return true;
    }
}

/**
 * Whitelist champs d’adresse Woo (évite d’appeler un setter inexistant).
 */
if (!function_exists('ballou_address_allowed_keys')) {
    function ballou_address_allowed_keys(): array
    {
        return [
            'first_name',
            'last_name',
            'company',
            'address_1',
            'address_2',
            'city',
            'state',
            'postcode',
            'country',
            'phone',
            'email',
        ];
    }
}

/**
 * Applique proprement les champs d’adresse sur WC_Customer {billing|shipping}_*
 */
if (!function_exists('ballou_apply_address')) {
    function ballou_apply_address(WC_Customer $customer, string $type, array $data): void
    {
        $allowed = ballou_address_allowed_keys();
        foreach ($data as $k => $v) {
            if (!in_array($k, $allowed, true)) continue;
            $method = "set_{$type}_" . $k; // ex: set_billing_address_1
            if (method_exists($customer, $method)) {
                $customer->$method(wc_clean($v));
            }
        }
    }
}

/** ─────────────────────────────────────────────────────────────────────
 * Routes
 * ──────────────────────────────────────────────────────────────────── */
add_action('rest_api_init', function () {

    /**
     * GET /ballou/v1/account/orders?page=1&per_page=10
     * Retour: { items: [...], hasMore: bool, page: int, totalPages: int }
     */
    register_rest_route('ballou/v1', '/account/orders', [
        'methods'             => 'GET',
        'permission_callback' => function () {
            return ballou_rest_require_login();
        },
        'callback'            => function (WP_REST_Request $req) {

            if (!class_exists('WooCommerce')) {
                return new WP_Error('ballou_wc_missing', 'WooCommerce n’est pas actif.', ['status' => 500]);
            }

            $uid      = get_current_user_id();
            $page     = max(1, (int)($req->get_param('page') ?: 1));
            $per_page = min(20, max(1, (int)($req->get_param('per_page') ?: 10)));

            // Pagination officielle Woo: 'paginate' => true + 'page' + 'limit'
            $result = wc_get_orders([
                'customer'  => $uid,       // ← clé correcte pour ID client
                'status'    => 'any',      // toutes
                'orderby'   => 'date',
                'order'     => 'DESC',
                'paginate'  => true,
                'page'      => $page,
                'limit'     => $per_page,
                'return'    => 'objects',
            ]);

            $orders      = $result->orders ?? [];
            $total_pages = (int)($result->max_num_pages ?? 1);

            $items = array_map(function (WC_Order $order) {
                return [
                    'id'       => $order->get_id(),
                    'date'     => $order->get_date_created() ? wc_format_datetime($order->get_date_created(), 'd/m/Y') : '',
                    'status'   => wc_get_order_status_name($order->get_status()),
                    'total' => strip_tags(wp_strip_all_tags($order->get_formatted_order_total())),
                    'view_url' => $order->get_view_order_url(),
                ];
            }, $orders);

            return new WP_REST_Response([
                'items'      => $items,
                'hasMore'    => $page < $total_pages,
                'page'       => $page,
                'totalPages' => $total_pages,
            ], 200);
        },
    ]);

    /**
     * GET /ballou/v1/account/me
     * Retourne user + billing + shipping (lecture simple)
     */
    register_rest_route('ballou/v1', '/account/me', [
        'methods'             => 'GET',
        'permission_callback' => function () {
            return ballou_rest_require_login();
        },
        'callback'            => function () {
            $uid   = get_current_user_id();
            $u     = get_userdata($uid);
            if (!$u) return new WP_REST_Response(['success' => false, 'message' => 'Utilisateur introuvable.'], 404);

            $customer = new WC_Customer($uid);
            $data = [
                'user' => [
                    'id'           => $uid,
                    'display_name' => $u->display_name,
                    'email'        => $u->user_email,
                    'first_name'   => get_user_meta($uid, 'first_name', true),
                    'last_name'    => get_user_meta($uid, 'last_name', true),
                ],
                // On renvoie un objet clé->valeur, pas la chaîne formatée
                'billing'  => [
                    'first_name' => $customer->get_billing_first_name(),
                    'last_name'  => $customer->get_billing_last_name(),
                    'company'    => $customer->get_billing_company(),
                    'address_1'  => $customer->get_billing_address_1(),
                    'address_2'  => $customer->get_billing_address_2(),
                    'city'       => $customer->get_billing_city(),
                    'state'      => $customer->get_billing_state(),
                    'postcode'   => $customer->get_billing_postcode(),
                    'country'    => $customer->get_billing_country(),
                    'phone'      => $customer->get_billing_phone(),
                    'email'      => $customer->get_billing_email(),
                ],
                'shipping' => [
                    'first_name' => $customer->get_shipping_first_name(),
                    'last_name'  => $customer->get_shipping_last_name(),
                    'company'    => $customer->get_shipping_company(),
                    'address_1'  => $customer->get_shipping_address_1(),
                    'address_2'  => $customer->get_shipping_address_2(),
                    'city'       => $customer->get_shipping_city(),
                    'state'      => $customer->get_shipping_state(),
                    'postcode'   => $customer->get_shipping_postcode(),
                    'country'    => $customer->get_shipping_country(),
                    'phone'      => '', // WC ne stocke pas phone shipping par défaut
                    'email'      => '', // idem
                ],
            ];
            return new WP_REST_Response($data, 200);
        },
    ]);

    /**
     * POST /ballou/v1/account/me
     * Body JSON: { first_name, last_name, email, billing?, shipping?, new_password? }
     */
    register_rest_route('ballou/v1', '/account/me', [
        'methods'             => 'POST',
        'permission_callback' => function () {
            return ballou_rest_require_login();
        },
        'callback'            => function (WP_REST_Request $req) {

            if (!class_exists('WooCommerce')) {
                return new WP_Error('ballou_wc_missing', 'WooCommerce n’est pas actif.', ['status' => 500]);
            }

            $uid = get_current_user_id();
            $p   = $req->get_json_params();

            $first = sanitize_text_field($p['first_name'] ?? '');
            $last  = sanitize_text_field($p['last_name'] ?? '');
            $email = sanitize_email($p['email'] ?? '');
            $pwd   = isset($p['new_password']) ? (string) $p['new_password'] : '';

            if (!$first || !$last || !is_email($email)) {
                return new WP_REST_Response(['success' => false, 'message' => 'Champs invalides.'], 400);
            }

            // Email déjà utilisé par un autre compte ?
            $conflict = get_user_by('email', $email);
            if ($conflict && intval($conflict->ID) !== intval($uid)) {
                return new WP_REST_Response(['success' => false, 'message' => 'Email déjà utilisé.'], 400);
            }

            // MAJ core user
            $u = [
                'ID'         => $uid,
                'user_email' => $email,
                'first_name' => $first,
                'last_name'  => $last,
            ];
            if ($pwd !== '') $u['user_pass'] = $pwd;

            $r = wp_update_user($u);
            if (is_wp_error($r)) {
                return new WP_REST_Response(['success' => false, 'message' => $r->get_error_message()], 400);
            }

            // MAJ adresses Woo si présentes
            $customer = new WC_Customer($uid);

            if (!empty($p['billing']) && is_array($p['billing'])) {
                ballou_apply_address($customer, 'billing', (array)$p['billing']);
            }
            if (!empty($p['shipping']) && is_array($p['shipping'])) {
                ballou_apply_address($customer, 'shipping', (array)$p['shipping']);
            }
            $customer->save();

            return new WP_REST_Response(['success' => true, 'message' => 'Informations mises à jour.'], 200);
        },
    ]);
});

/** ─────────────────────────────────────────────────────────────────────
 * Localisation des variables JS (nonce + home_url)
 * ⚠️ Remplace le handle 'ballou-main-js' par le handle réel de ton bundle Vite.
 * ──────────────────────────────────────────────────────────────────── */
add_action('wp_enqueue_scripts', function () {
    // Localiser seulement quand le script principal est en file d’attente
    $handle = 'ballou-main-js'; // ← METS ICI TON HANDLE VITE
    if (wp_script_is($handle, 'enqueued') || wp_script_is($handle, 'queue')) {
        wp_localize_script($handle, 'wcApiData', [
            'nonce'    => wp_create_nonce('wp_rest'),
            'home_url' => home_url('/'),
        ]);
    }
});
