<?php

/**
 * Menus personnalisés pour le thème Ballou (WP + WooCommerce).
 * Enregistre les menus : principal, footer (liens utiles), produits (catégories Woo), social (Instagram, etc.).
 * Ajoute les catégories produits au menu admin et gère fallback pour social.
 * Options ACF pour logos/footer (optionnel).
 */

// Enregistrer les menus personnalisés
function register_custom_menus()
{
    // Enregistrer les menus
    register_nav_menus(array(
        'primary' => __('Menu principal', 'ballou'),
        'footer' => __('Menu du pied de page', 'ballou'),  // Rang 2 footer : Contact, À propos, CGV, Cookies
        'product_menu' => __('Menu des produits', 'ballou'), // Menu pour les produits (catégories Woo)
        'social' => __('Menu social', 'ballou'),  // Rang 3 footer : Instagram, YouTube, Facebook, LinkedIn
    ));
}
add_action('after_setup_theme', 'register_custom_menus');

// Fonction pour récupérer les liens sociaux (WP menu ou fallback hardcoded)
function get_social_menu_items()
{
    $social_menu = wp_get_nav_menu_items('social');  // Récupère menu social depuis WP Admin
    if (!$social_menu || empty($social_menu)) {
        // Fallback hardcoded si menu vide (adaptez URLs réelles)
        return [
            ['title' => 'Facebook', 'url' => 'https://www.facebook.com/ballou.madagascar'],
            ['title' => 'Instagram', 'url' => 'https://www.instagram.com/ballou_madagascar/'],  // Remplacez par URL réelle
            ['title' => 'LinkedIn', 'url' => 'https://www.linkedin.com/company/ballou-madagascar/'],  // Nouveau : LinkedIn ; adaptez
            ['title' => 'YouTube', 'url' => 'https://www.youtube.com/@balloumadagascar'],  // Exemple
        ];
    }
    // Convertit menu WP en array simple (title/url)
    return array_map(function ($item) {
        return [
            'title' => $item->title,
            'url' => $item->url,
        ];
    }, $social_menu);
}

// Ajouter les catégories de produits au menu admin (pour product_menu)
function add_product_categories_to_menu()
{
    // Pas besoin de register_nav_menu ici (déjà fait) – c'est redondant

    // Ajouter les catégories WooCommerce ('product_cat') comme éléments disponibles dans l'admin menus
    // Utilise un hook plus approprié : 'wp_nav_menu_item_custom_fields' ou filtre pour populer la liste
    // Simplifié : Ajoute un filtre pour injecter les catégories lors de la sélection du menu 'product_menu'
    add_filter('wp_edit_nav_menu_walker', function () {
        return 'Walker_Nav_Menu_Edit';  // Utilise le walker par défaut (gère taxos)
    });

    // Pour ajouter auto les catégories produits dans la liste des éléments du menu (admin)
    // Hook : Ajoute un custom meta box ou filtre la liste des items disponibles
    add_action('admin_init', function () {
        if (current_user_can('edit_theme_options')) {
            // Ajoute les catégories produits à la liste des éléments sélectionnables dans l'admin menus
            add_filter('nav_menu_items', 'add_product_categories_nav_menu_items', 10, 2);
        }
    });

    // Fonction pour ajouter les catégories produits à la liste des items dans l'admin
    function add_product_categories_nav_menu_items($items, $args)
    {
        // Seulement si on est en admin et pour menu 'product_menu'
        if (!is_admin() || !isset($_GET['menu-location']) || $_GET['menu-location'] !== 'product_menu') {
            return $items;
        }

        // Récupérer catégories produits (parents)
        $product_categories = get_terms(array(
            'taxonomy' => 'product_cat',
            'orderby' => 'name',
            'hide_empty' => false,
            'parent' => 0,  // Catégories principales
        ));

        // Ajouter chaque catégorie comme item potentiel
        foreach ($product_categories as $category) {
            $items[] = new stdClass();
            $items[count($items) - 1]->ID = $category->term_id;
            $items[count($items) - 1]->title = $category->name;
            $items[count($items) - 1]->url = get_term_link($category);
            $items[count($items) - 1]->type = 'taxonomy';
            $items[count($items) - 1]->object = 'product_cat';
            $items[count($items) - 1]->object_id = $category->term_id;
            $items[count($items) - 1]->menu_item_parent = 0;  // Pas parent
            $items[count($items) - 1]->db_id = 0;  // Pas saved
            $items[count($items) - 1]->description = 'Catégorie produit: ' . $category->name;

            // Ajouter sous-catégories comme enfants (indentés)
            $sub_categories = get_terms(array(
                'taxonomy' => 'product_cat',
                'orderby' => 'name',
                'hide_empty' => false,
                'parent' => $category->term_id,  // Sous-catégories
            ));

            foreach ($sub_categories as $sub_category) {
                $items[] = new stdClass();
                $items[count($items) - 1]->ID = $sub_category->term_id;
                $items[count($items) - 1]->title = '— ' . $sub_category->name;  // Indent pour sous-cat
                $items[count($items) - 1]->url = get_term_link($sub_category);
                $items[count($items) - 1]->type = 'taxonomy';
                $items[count($items) - 1]->object = 'product_cat';
                $items[count($items) - 1]->object_id = $sub_category->term_id;
                $items[count($items) - 1]->menu_item_parent = $category->term_id;  // Parent = catégorie principale
                $items[count($items) - 1]->db_id = 0;
                $items[count($items) - 1]->description = 'Sous-catégorie: ' . $sub_category->name;
            }
        }

        return $items;
    }
}
add_action('after_setup_theme', 'add_product_categories_to_menu');

// ← Utilitaire : Récupérer menu footer pour props (utilisé en footer.php)
function get_footer_menu_items()
{
    $footer_menu = wp_get_nav_menu_items('footer');
    if (!$footer_menu || empty($footer_menu)) {
        // Fallback hardcoded si menu vide (pages/links : Contact, etc.)
        return [
            ['title' => 'Contact', 'url' => home_url('/contact')],
            ['title' => 'À propos de nous', 'url' => home_url('/a-propos')],
            ['title' => 'CGV', 'url' => home_url('/cgv')],
            ['title' => 'Charte sur les cookies', 'url' => home_url('/cookies')],
        ];
    }
    return array_map(function ($item) {
        return [
            'title' => $item->title,
            'url' => $item->url,
        ];
    }, $footer_menu);
}

// ← Optionnel : Page Options ACF pour Footer (logos, FB ID, etc.)
// Nécessite ACF Pro installé
if (function_exists('acf_add_options_page')) {
    add_action('init', function () {
        acf_add_options_page([
            'page_title' => 'Options Footer',
            'menu_title' => 'Footer Options',
            'menu_slug' => 'footer-options',
            'capability' => 'edit_posts',
            'redirect' => false,
            'icon_url' => 'dashicons-admin-generic',
        ]);
        // Ajoutez fields ACF (dans ACF > Field Groups > New Group > Location: Options Page = Footer Options)
        // Exemples fields : logo_balloupro (Image), fb_page_id (Text), social_instagram_url (URL), etc.
        // Puis récupérez via get_field('logo_balloupro', 'option') en PHP props footer.
    });
}
