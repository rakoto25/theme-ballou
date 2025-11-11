<?php
// Sécurité de base
if (!defined('ABSPATH')) exit;

// --- Définition des Constantes API (au début pour localize)
if (!defined('WC_CONSUMER_KEY')) define('WC_CONSUMER_KEY', 'ck_c45c7f8d0c66c191817cb23c42e1de6ceb3babe8');  // Assurez-vous que c'est Read/Write pour admin
if (!defined('WC_CONSUMER_SECRET')) define('WC_CONSUMER_SECRET', 'cs_f96a09cfef030021954c2613fd7768b37fad6293');  // Idem

// --- Debug manifest en <head> (facultatif)
add_action('wp_head', function () {
    $m = ballou_vite_manifest();
    if (!$m) {
        echo "<!-- manifest introuvable -->";
    } else {
        echo "<!-- js: " . esc_html(implode(',', $m['js'])) . " -->";
    }
});

// Chargements des modules internes
require_once get_stylesheet_directory() . '/inc/rest-show-product-category.php';
require_once get_stylesheet_directory() . '/inc/rest_cart.php';
require_once get_stylesheet_directory() . '/inc/rest_bestseller.php';
require_once get_stylesheet_directory() . '/inc/rest_oursselect.php';
require_once get_stylesheet_directory() . '/inc/rest_bestcategory.php';
require_once get_stylesheet_directory() . '/inc/rest_products.php';
require_once get_stylesheet_directory() . '/inc/rest_checkout.php';
require_once get_stylesheet_directory() . '/inc/rest-show-logo.php';
require_once get_stylesheet_directory() . '/inc/rest_account.php';
require_once get_stylesheet_directory() . '/inc/rest_login.php';
require_once get_stylesheet_directory() . '/inc/rest_register.php';
require_once get_stylesheet_directory() . '/inc/search.php';
require_once get_stylesheet_directory() . '/inc/includes.php';
require_once get_stylesheet_directory() . '/inc/menus.php';
require_once get_stylesheet_directory() . '/inc/vite.php';
require_once get_stylesheet_directory() . '/inc/seo.php';
require_once get_stylesheet_directory() . '/inc/ajax.php';
// API REST Ballou (thankyou + checkout)
if (class_exists('WooCommerce')) {
    require_once get_template_directory() . '/inc/rest_thankyou.php'; // Ajustez path si fichier ailleurs (ex. /inc/thankyou_rest.php)
}


// Supports de thème
add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('woocommerce');
    add_theme_support('html5', ['search-form', 'gallery', 'caption', 'script', 'style']);
});

add_action('wp_head', function () {
    if (is_user_logged_in() || current_user_can('administrator')) {  // Optionnel : debug only
?>
        <script>
            window.__BALLOU__ = window.__BALLOU__ || {};
            window.__BALLOU__.homeUrl = '<?php echo esc_js(trailingslashit(home_url())); ?>';
        </script>
<?php
    }
});

// functions.php – Corrigé : Injecte API base correcte avec /ballou/ si présent
function enqueue_ballou_globals()
{
    if (!is_admin() && wp_script_is('main-bundle', 'enqueued')) {
        // Détecte le chemin WP correct (site_url() vs rest_url())
        // rest_url() inclut automatiquement le répertoire '/ballou/' si configuré
        $api_base = rest_url(); // Ex: http://localhost/ballou/wp-json (avec trailing slash)
        $api_base = rtrim($api_base, '/'); // Remove trailing slash

        wp_localize_script('main-bundle', '__BALLOU__', [
            'siteUrl' => site_url(),
            'homeUrl' => home_url(),
            'apiBase' => $api_base,  // NOUVEAU : Full rest_url (inclut /ballou/ si présent)
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('wp_rest'),
            'restApiBase' => rest_url(),  // Alias, avec trailing slash
        ]);
    }
}
add_action('wp_enqueue_scripts', 'enqueue_ballou_globals', 20);

// ← Ajoutez en bas functions.php (test only ; retirez après)
add_action('wp_mail_failed', function ($wp_error) {
    error_log("WP Mail Failed: " . print_r($wp_error, true));  // Log si wp_mail() false (SMTP absent)
}, 10, 1);

add_action('wpcf7_before_send_mail', function ($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    if ($submission) {
        $posted_data = $submission->get_posted_data();
        error_log("CF7 Before Send Mail: ID=" . $contact_form->id() . ", Data=" . print_r($posted_data, true));  // Log champs avant envoi
    }
}, 10, 1);

add_action('wpcf7_mail_sent', function ($contact_form) {
    error_log("CF7 Mail Sent OK: ID=" . $contact_form->id());  // Log succès
}, 10, 1);

add_filter('wpcf7_validate', function ($result, $tag) {
    if (isset($result['status']) && $result['status'] === 'validation_failed') {
        error_log("CF7 Validation Failed: " . print_r($result['invalid_fields'], true));  // Log validation
    }
    return $result;
}, 10, 2);

// Force log CF7 errors (si plugin silent)
add_action('wpcf7_admin_notices', function () {
    // Pas direct, mais check admin
});

// Autorise les iframes Facebook (contourne X-Frame-Options et CSP pour embeds)
function allow_fb_iframes()
{
    header('X-Frame-Options: ALLOW-FROM https://www.facebook.com');
    header("Content-Security-Policy: frame-ancestors 'self' https://www.facebook.com https://*.facebook.com;");
}
add_action('init', 'allow_fb_iframes');  // Ou 'send_headers'

// Optionnel : Redirige ancien /my-account Woo vers /mon-compte
add_action('template_redirect', function () {
    if (is_account_page() && !is_page('mon-compte')) {
        wp_redirect(home_url('/mon-compte/'), 301);
        exit;
    }
});

// Enqueue bundle main.tsx (build Vite) + localize (CORRIGÉ : Localize wcApiData AVEC keys API pour MyAccount fix 403)
add_action('wp_enqueue_scripts', function () {
    if (is_page('mon-compte')) {  // Seulement cette page
        // Bundle principal (assume Vite build : assets/dist/main.js)
        wp_enqueue_script(
            'main-bundle',  // Handle
            get_template_directory_uri() . '/assets/dist/main.js',  // Ajustez chemin Vite output si besoin
            [],  // Pas de deps (bundle inclut React)
            '1.0.3',  // Version incrémentée pour cache flush
            true  // Footer
        );


        // CORRIGÉ : Utilise WC_CONSUMER_KEY/SECRET définis au top (Read/Write requis)
        wp_localize_script('main-bundle', 'wcApiData', [
            'consumer_key' => WC_CONSUMER_KEY,  // Clé Read/Write pour admin (essentiel fix 403)
            'consumer_secret' => WC_CONSUMER_SECRET,  // Secret correspondant
            'nonce' => wp_create_nonce('wp_rest'),  // Pour /users/me ou fallback
            'home_url' => home_url('/'),  // Inclut /ballou/ si subdir
            'ajax_url' => admin_url('admin-ajax.php'),  // Si AJAX alternatif
        ]);

        // Log debug pour vérifier localize (console admin)
        if (current_user_can('administrator')) {
            error_log('wcApiData localisé pour /mon-compte : keys=' . (WC_CONSUMER_KEY ? 'oui' : 'non') . ', nonce=' . wp_create_nonce('wp_rest'));
        }
    }
});

// HOOKS FIX 403 MyAccount (nettoyés : duplicates supprimés, ordre logique)
// Hook 1 : Bypass permissions pour update customers (fix 403 Write)
add_filter('woocommerce_rest_check_permissions', function ($permission, $context, $object_id, $read) {
    if ($context === 'customer' && !$read) {  // Seulement pour Write customers
        return true;
    }
    return $permission;
}, 10, 4);

// Hook 2 : Bypass validation customer update (unique, pas duplicate)
add_filter('woocommerce_rest_customer_update_callback', '__return_true', 10, 4);

// Hook 3 : Pour password /users/me 403 : Autorise edit profil pour logged-in users (sécurité améliorée)
add_filter('rest_user_update_permissions_check', function ($prepared_args, $request) {
    if (is_user_logged_in()) {  // Seulement users connectés (pas tous)
        return true;
    }
    return $prepared_args;
}, 10, 2);

// Hook 4 : Crée auto customer record si absent pour l'user connecté (fix 404/400 sur PUT /customers/{id})
add_action('init', function () {
    if (is_user_logged_in() && is_page('mon-compte')) {  // Seulement sur la page
        $user_id = get_current_user_id();
        $customer_id = get_user_meta($user_id, 'customer_id', true);
        if (!$customer_id) {
            // Crée le customer Woo si absent (utilise email user)
            $user = get_userdata($user_id);
            $customer_id = wc_create_new_customer($user->user_email, $user->user_login, $user->user_pass);
            if ($customer_id) {
                update_user_meta($user_id, 'customer_id', $customer_id);
                error_log('Customer créé auto pour user ID=' . $user_id . ' : customer_id=' . $customer_id);  // Log debug
            }
        }
    }
}, 5);  // Priorité haute pour init avant requests

// Flush permalinks auto après hooks (pour REST endpoints)
add_action('after_switch_theme', 'flush_rewrite_rules');
add_action('init', function () {
    if (get_option('ballou_flush_permalinks_once') !== 'done') {
        flush_rewrite_rules();
        update_option('ballou_flush_permalinks_once', 'done');
    }
}, 999);

// Optionnel : Log debug pour REST requests (test only, retirez en prod)
add_action('rest_api_init', function () {
    if (current_user_can('administrator') && defined('WP_DEBUG') && WP_DEBUG) {
        add_filter('rest_pre_dispatch', function ($result, $server, $request) {
            error_log('REST Request: ' . $request->get_method() . ' ' . $request->get_route() . ' - User ID: ' . get_current_user_id());
            if ($request->get_route() === '/wc/v3/customers/(?P<id>[\d]+)') {
                error_log('MyAccount Update Tentative : ID=' . $request->get_param('id') . ', Auth: ' . (isset($_SERVER['HTTP_AUTHORIZATION']) ? 'Basic présent' : 'Absent'));
            }
            return $result;
        }, 10, 3);
    }
});

// Force l'URL "order received" → /merci/?key=...
add_filter('woocommerce_get_checkout_order_received_url', function ($url, $order) {
    if (!$order instanceof WC_Order) return $url;
    $key = $order->get_order_key();
    return home_url('/merci/?key=' . rawurlencode($key));
}, 10, 2);

// Quand un paiement est "réussi", Woo renvoie souvent un tableau avec 'redirect'
add_filter('woocommerce_payment_successful_result', function ($result, $order_id) {
    $order = wc_get_order($order_id);
    if ($order instanceof WC_Order) {
        $result['redirect'] = home_url('/merci/?key=' . rawurlencode($order->get_order_key()));
    }
    return $result;
}, 10, 2);

// Pare-chocs : toute visite de /validation-de-commande/order-pay/{id}/?key=... → /merci/?key=...
add_action('template_redirect', function () {
    if (function_exists('is_checkout_pay_page') && is_checkout_pay_page()) {
        $key = isset($_GET['key']) ? sanitize_text_field($_GET['key']) : '';
        if ($key) {
            wp_safe_redirect(home_url('/merci/?key=' . rawurlencode($key)));
            exit;
        }
    }
});

// cors
add_action('rest_api_init', function () {
    // Autoriser les requêtes CORS (pour les devs uniquement, à éviter en prod)
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-WP-Nonce");
});
