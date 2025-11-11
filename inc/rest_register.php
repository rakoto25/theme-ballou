<?php

/**
 * Ballou REST API – Enregistrement utilisateur WooCommerce
 * Endpoint : /wp-json/ballou/v1/register
 */

if (!defined('ABSPATH')) exit;

class Ballou_Register_REST
{
    const NAMESPACE = 'ballou/v1';

    public function __construct()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes()
    {
        register_rest_route(self::NAMESPACE, '/register', [
            'methods'  => 'POST',
            'callback' => [$this, 'handle_register'],
            'permission_callback' => '__return_true',
        ]);
    }

    public function handle_register(WP_REST_Request $request)
    {
        $username = sanitize_user($request->get_param('username'));
        $email    = sanitize_email($request->get_param('email'));
        $password = $request->get_param('password');

        // ✅ Validation basique
        if (empty($username) || empty($email) || empty($password)) {
            return new WP_REST_Response(['error' => 'Tous les champs sont requis.'], 400);
        }

        if (!is_email($email)) {
            return new WP_REST_Response(['error' => 'Adresse e-mail invalide.'], 400);
        }

        if (username_exists($username) || email_exists($email)) {
            return new WP_REST_Response(['error' => 'Nom d’utilisateur ou e-mail déjà utilisé.'], 409);
        }

        // ✅ Création utilisateur
        $user_id = wp_create_user($username, $password, $email);

        if (is_wp_error($user_id)) {
            return new WP_REST_Response(['error' => $user_id->get_error_message()], 500);
        }

        // ✅ Rôle WooCommerce "customer"
        $user = new WP_User($user_id);
        $user->set_role('customer');

        // ✅ Auto-login immédiat
        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id);

        // ✅ Réponse
        return new WP_REST_Response([
            'success' => true,
            'message' => 'Inscription réussie.',
            'user_id' => $user_id,
            'email' => $email,
        ], 200);
    }
}

new Ballou_Register_REST();
