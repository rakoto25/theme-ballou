</main>
<style>
    .site-footer {
        padding-block: 0 !important;
        margin-top: 0 !important;
        /* Si vous voulez supprimer le margin-top global aussi */
    }
</style>
<footer class="site-footer" style="padding-block: 0; margin-top: 0; border-top: 1px solid currentColor;"> <!-- Override inline : padding-block: 0 pour supprimer la marge bleue ; border-top conservé -->
    <div data-island="footer" data-props='<?php
                                            // ← Incluez menus.php si pas déjà (ex: en functions.php : require get_template_directory() . '/inc/menus.php';)
                                            // Props pour React : Menu footer WP (liens utiles), social, adresse, logos, FB
                                            $footer_menu = function_exists('get_footer_menu_items') ? get_footer_menu_items() : [];  // ← FIX : Fallback [] si func undefined
                                            $social_menu = function_exists('get_social_menu_items') ? get_social_menu_items() : [];  // Rang 3 + copyright

                                            // ← Logo Ballou via REST func (custom_logo ou site_icon)
                                            require_once get_template_directory() . '/inc/rest-show-logo.php';  // Incluez si pas global
                                            $logo_ballou_url = function_exists('ballou_get_logo_url') ? ballou_get_logo_url() : '';  // ← FIX : Fallback '' si func undefined

                                            // ← ID de la Page FB (numérique, pour href direct)
                                            $fb_page_id = '100064876740503';  // ← VOTRE ID PAGE (utilisé pour embed + image profil)

                                            // ← App ID FB (remplacez par votre vrai ID ; créez sur developers.facebook.com si vide)
                                            $fb_app_id = '';  // Ex: '1234567890123456' – Obligatoire pour embed live ; mettez ici pour activer iframe

                                            // ← URL embed : Activez seulement si $fb_app_id non vide ; utilise ID page pour href direct
                                            $embed_url = '';
                                            if ($fb_app_id) {
                                                $embed_url = 'https://www.facebook.com/plugins/page.php?href=' . urlencode($fb_page_id) . '&tabs=timeline&width=500&height=250&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId=' . $fb_app_id;
                                            }

                                            $footer_props = [
                                                'menuItems' => $footer_menu,  // ← FIX : Liens WP visibles maintenant (array safe)
                                                'socialLinks' => $social_menu,  // Insta, FB, LinkedIn, etc. (array safe)
                                                'address' => 'Rue du Docteur Joseph Raseta, Andraharo Antananarivo, Madagascar',  // Rang 1
                                                'logoBallou' => $logo_ballou_url,  // ← FIX : Dynamique via API func (URL ou '')
                                                'logoBallouPro' => get_template_directory_uri() . '/assets/images/logo-balloupro.png',  // Rang 2 ; adaptez path ou ACF: get_field('logo_balloupro', 'option')
                                                'fbPageUrl' => 'https://www.facebook.com/ballou.madagascar',  // Rang 3 : URL publique (fallback)
                                                'fbPageId' => $fb_page_id,  // ← NOUVEAU : ID numérique pour embed direct + image profil
                                                'latestNewsEmbed' => $embed_url,  // ← Vide si pas d'appId (force fallback TS) ; sinon URL complète avec ID page
                                            ];
                                            echo esc_attr(wp_json_encode($footer_props, JSON_UNESCAPED_SLASHES));  // ← FIX : JSON_UNESCAPED_SLASHES pour URLs FB safe
                                            ?>'>
        <!-- Fallback No-JS : Layout complet (logo, adresse, menu, © Ballou, social) – Centré et responsive, sans marge bleue en bas -->
        <noscript>
            <div class="container mx-auto px-4 pt-12 pb-0 text-center text-sm" style="background-color: #29235c; color: #f9fafb;"> <!-- pt-12 pb-0 pour matcher React -->
                <!-- Logo Placeholder si pas de JS -->
                <?php if (empty($logo_ballou_url)) : ?>
                    <div class="mb-4 inline-block">
                        <svg class="h-12 w-auto" style="color: #f9fafb;" fill="currentColor" viewBox="0 0 168 168">
                            <path d="M0 0h168v168H0z" />
                            <text x="84" y="90" fontSize="24" textAnchor="middle" fill="currentColor">Ballou</text>
                        </svg>
                    </div>
                <?php endif; ?>

                <!-- Adresse -->
                <p class="mb-4 leading-relaxed max-w-md mx-auto"><?php echo esc_html('Rue du Docteur Joseph Raseta, Andraharo Antananarivo, Madagascar'); ?></p>

                <!-- Menu Liens utiles (vertical) -->
                <h3 class="text-lg font-semibold mb-4">Liens utiles</h3>
                <ul class="space-y-2 mb-8 max-w-md mx-auto">
                    <?php foreach ($footer_menu as $item) : ?>
                        <li>
                            <a href="<?php echo esc_url($item['url'] ?? '#'); ?>" class="block hover:text-[#e94e1b] transition-colors py-1"><?php echo esc_html($item['title'] ?? 'Lien'); ?></a>
                        </li>
                    <?php endforeach; ?>
                </ul>

                <!-- Logo BallouPro (liénifié : Home site, même onglet) -->
                <?php
                $logo_pro_path = get_template_directory_uri() . '/assets/images/logo-balloupro.png';
                $logo_exists = file_exists(get_template_directory() . '/assets/images/logo-balloupro.png');
                ?>
                <?php if ($logo_exists) : ?>
                    <a
                        href="<?php echo esc_url(home_url('/https://balloupro.mg')); ?>" ,
                        title="Retour à l'accueil Ballou" target="_blank"
                        aria-label="Accueil Ballou Pro"
                        class="inline-block">
                        <img
                            src="<?php echo esc_url($logo_pro_path); ?>"
                            alt="Ballou Pro"
                            class="mx-auto mb-4 h-8 w-auto transition-transform hover:scale-105" // Ajout hover subtil (optionnel) />
                    </a>
                <?php endif; ?>

                <!-- Dernières actualités (lien simple sans embed pour no-JS) -->
                <h3 class="text-lg font-semibold mb-4">Dernières actualités</h3>
                <div class="mb-4 p-4 bg-blue-900/20 rounded text-left max-w-md mx-auto">
                    <p class="text-sm mb-2">Suivez Ballou sur Facebook pour les dernières news.</p>
                    <a href="https://www.facebook.com/ballou.madagascar" target="_blank" rel="noopener" class="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                        <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        Voir sur Facebook
                    </a>
                </div>

                <!-- Copyright + Social (fond orange, collé en bas sans marge, via style inline pour no-JS) -->
                <div style="background-color: #e94e1b; color: #f9fafb; padding: 1rem; border-top: 1px solid rgba(59, 130, 246, 0.5); margin-top: 0;"> <!-- margin-top: 0 pour coller -->
                    <div class="flex flex-col sm:flex-row justify-between items-center text-sm">
                        <span>© <?php echo date('Y'); ?> Ballou Madagascar</span>
                        <div class="flex space-x-4 mt-2 sm:mt-0">
                            <?php foreach ($social_menu as $link) : ?>
                                <a href="<?php echo esc_url($link['url'] ?? '#'); ?>" target="_blank" rel="noopener" class="hover:text-white p-1" aria-label="<?php echo esc_attr($link['title'] ?? 'Social'); ?>">
                                    <!-- Icônes SVG simples inline pour no-JS (FB, Insta, etc.) – SVGs complets -->
                                    <?php
                                    $icon = '';
                                    $title = strtolower($link['title'] ?? '');
                                    if (strpos($title, 'facebook') !== false) {
                                        $icon = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
                                    } elseif (strpos($title, 'instagram') !== false) {
                                        $icon = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>';
                                    } elseif (strpos($title, 'linkedin') !== false) {
                                        $icon = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
                                    } else {
                                        $icon = esc_html($link['title'] ?? '?');
                                    }
                                    echo $icon;
                                    ?>
                                </a>
                            <?php endforeach; ?>
                            <span class="hidden sm:inline">Suivez-nous :</span>
                        </div>
                    </div>
                </div>
            </div>
        </noscript>
    </div>
    <!-- Pas de div copyright extérieur : tout géré par React ou noscript -->
</footer>

<?php wp_footer(); ?>
</body>

</html>