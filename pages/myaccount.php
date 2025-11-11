<?php
/*
 * Template Name: Page mon compte
 * Description: Page personnalisée pour le compte utilisateur (hybride PHP + React island)
 */
if (!defined('ABSPATH')) exit;

if (!class_exists('WooCommerce')) {
    get_header();
    echo '<div class="mx-auto my-16 max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">WooCommerce n\'est pas actif.</div>';
    get_footer();
    return;
}

get_header();

if (!is_user_logged_in()) {
    echo '<div class="mx-auto my-16 max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">';
    echo '<p class="mb-4 text-center text-zinc-700">Veuillez vous connecter pour accéder à votre compte.</p>';
    woocommerce_login_form();
    echo '</div>';
    get_footer();
    return;
}

$current_user = wp_get_current_user();
$customer     = new WC_Customer($current_user->ID);

// Fallback commandes (5 dernières) pour premier rendu SSR
$orders = wc_get_orders([
    'customer_id' => $current_user->ID,
    'limit'       => 5,
    'orderby'     => 'date',
    'order'       => 'DESC',
    'status'      => array_keys(wc_get_order_statuses()),
]);
$orders_data = array_map(function ($order) {
    /** @var WC_Order $order */
    return [
        'id'       => $order->get_id(),
        'date'     => $order->get_date_created() ? $order->get_date_created()->date_i18n('d/m/Y') : '',
        'status'   => wc_get_order_status_name($order->get_status()),
        'total'    => $order->get_formatted_order_total(),
        'view_url' => $order->get_view_order_url(),
    ];
}, $orders ?: []);

$user_meta = [
    'id'           => $current_user->ID,
    'display_name' => $current_user->display_name,
    'email'        => $current_user->user_email,
    'first_name'   => get_user_meta($current_user->ID, 'first_name', true),
    'last_name'    => get_user_meta($current_user->ID, 'last_name', true),
];

$billing_address  = array_filter([
    'address_1' => $customer->get_billing_address_1(),
    'city'      => $customer->get_billing_city(),
    'postcode'  => $customer->get_billing_postcode(),
    'country'   => $customer->get_billing_country(),
]);
$shipping_address = array_filter([
    'address_1' => $customer->get_shipping_address_1(),
    'city'      => $customer->get_shipping_city(),
    'postcode'  => $customer->get_shipping_postcode(),
    'country'   => $customer->get_shipping_country(),
]);

$myaccount_data = [
    'user'             => $user_meta,
    'orders'           => $orders_data,
    'billing_address'  => $billing_address,
    'shipping_address' => $shipping_address,
    'logout_url'       => wp_logout_url(home_url()),
    'edit_account_url' => wc_get_endpoint_url('edit-account', '', wc_get_page_permalink('myaccount')),
];
?>
<div class="container mx-auto mt-10 mb-14 max-w-6xl px-4">
    <?php woocommerce_breadcrumb(); ?>
    <div
        id="myaccount-container"
        data-island="myaccount"
        data-props='<?php echo wp_json_encode($myaccount_data, JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES); ?>'>
        <div class="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600 shadow-sm">
            Chargement de votre compte…
        </div>
    </div>
</div>
<?php get_footer(); ?>