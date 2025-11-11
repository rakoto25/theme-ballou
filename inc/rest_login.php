<?php
add_action('rest_api_init', function () {
    register_rest_route('wp/v2', '/auth/login', [
        'methods' => 'POST',
        'callback' => 'handle_user_login',
        'permission_callback' => '__return_true',
    ]);
});

function handle_user_login(WP_REST_Request $request)
{
    $params = $request->get_json_params();
    $username = sanitize_text_field($params['username']);
    $password = sanitize_text_field($params['password']);
    $rememberme = isset($params['rememberme']) ? (bool) $params['rememberme'] : false;

    // Essayer de se connecter
    $user = wp_authenticate($username, $password);

    if (is_wp_error($user)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Nom d\'utilisateur ou mot de passe incorrect.',
        ], 401); // Unauthorized
    }

    // Connexion réussie
    wp_set_current_user($user->ID);
    wp_set_auth_cookie($user->ID, $rememberme);
    do_action('wp_login', $username, $user);

    // Retourner les données utilisateur en réponse
    return new WP_REST_Response([
        'success' => true,
        'message' => 'Connexion réussie',
        'user' => [
            'id' => $user->ID,
            'username' => $user->user_login,
            'display_name' => $user->display_name,
            'email' => $user->user_email,
        ]
    ], 200); // OK
}
