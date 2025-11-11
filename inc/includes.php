<?php
function theme_custom_logo_setup()
{
    // Support pour le logo personnalisé
    add_theme_support('custom-logo', array(
        'width'       => 160,  // Largeur du logo
        'height'      => 40,   // Hauteur du logo
        'flex-width'  => true, // Permet de redimensionner le logo
        'flex-height' => true, // Permet de redimensionner la hauteur du logo
    ));
}
add_action('after_setup_theme', 'theme_custom_logo_setup');
