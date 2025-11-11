<?php
// inc/vite.php
if (!defined('ABSPATH')) exit;

/**
 * =============================================================================
 *  Vite Manifest & Enqueue – Ballou Theme
 * =============================================================================
 * - Lit le manifest Vite (post `npm run build`) pour récupérer l'entry + imports.
 * - Enfile proprement CSS/JS avec versioning (filemtime).
 * - Injecte AVANT le module :
 *     - window.BALLOU_API_BASE (ex: http://localhost/ballou/wp-json)
 *     - window.__BALLOU__.restBaseSite (ex: .../wp-json/site-info/v1/)
 *     - window.__BALLOU__.restBaseBallou (ex: .../wp-json/ballou/v1/)
 *     - window.__BALLOU__.nonce (nonce 'wp_rest' pour les appels REST authentifiés)
 *     - window.__BALLOU__.home, window.__BALLOU__.ajaxUrl, window.__BALLOU__.homeUrl
 * - Fournit un helper `ballou_maybe_enqueue_vite()` pour les templates.
 * - Hook par défaut : global (à restreindre ensuite si besoin).
 * =============================================================================
 */

/**
 * Parse manifest et retourne toutes les URLs publiques (JS/CSS) de l'entry + imports.
 *
 * @return array|null ['js' => string[], 'css' => string[]] ou null si introuvable
 */
function ballou_vite_manifest()
{
    static $cache = null;
    if ($cache !== null) return $cache;

    $theme_dir = rtrim(get_stylesheet_directory(), '/');
    $theme_uri = rtrim(get_stylesheet_directory_uri(), '/');

    $candidates = [
        $theme_dir . '/assets/dist/manifest.json',
        $theme_dir . '/assets/dist/.vite/manifest.json', // fallback éventuel
    ];

    $file = null;
    foreach ($candidates as $c) {
        if (file_exists($c)) {
            $file = $c;
            break;
        }
    }
    if (!$file) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[Vite Manifest] File not found: ' . implode(', ', $candidates));
        }
        return null;
    }

    $json = json_decode(file_get_contents($file), true);
    if (!$json || !is_array($json)) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[Vite Manifest] Invalid JSON: ' . $file);
        }
        return null;
    }

    // Trouver l'entry : Priorité à isEntry, sinon première clé avec .js file (lib mode Vite)
    $entryKey = null;
    foreach ($json as $k => $v) {
        if (!empty($v['isEntry']) || (!empty($v['file']) && preg_match('~\.js$~i', $v['file']))) {
            $entryKey = $k;
            break;
        }
    }
    if (!$entryKey) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[Vite Manifest] No entry found. Keys: ' . implode(', ', array_keys($json)));
        }
        return null;
    }

    $visited = [];
    $js  = [];
    $css = [];

    $pushFiles = function ($key) use (&$pushFiles, &$visited, &$js, &$css, $json, $theme_uri) {
        if (isset($visited[$key])) return;
        $visited[$key] = true;

        $node = $json[$key] ?? null;
        if (!$node) return;

        // JS principal
        if (!empty($node['file']) && preg_match('~\.js$~i', $node['file'])) {
            $js[] = $theme_uri . '/assets/dist/' . ltrim($node['file'], '/');
        }
        // CSS éventuels
        if (!empty($node['css']) && is_array($node['css'])) {
            foreach ($node['css'] as $c) {
                $css[] = $theme_uri . '/assets/dist/' . ltrim($c, '/');
            }
        }
        // Imports récursifs
        if (!empty($node['imports']) && is_array($node['imports'])) {
            foreach ($node['imports'] as $imp) {
                $pushFiles($imp);
            }
        }
    };

    // Entry + imports
    $pushFiles($entryKey);

    // Nettoyage/unique
    $cache = [
        'js'  => array_values(array_unique($js)),
        'css' => array_values(array_unique($css)),
    ];

    if (defined('WP_DEBUG') && WP_DEBUG) {
        error_log('[Vite Manifest] Loaded: JS=' . count($cache['js']) . ', CSS=' . count($cache['css']));
    }

    return $cache;
}

/**
 * Enqueue dynamique des assets Vite (manifest) + injection des globals AVANT le module.
 *
 * @param string|array $pages Slug(s) de page où charger (ex: 'contact' ou ['contact','panier']).
 *                            Laisser vide [] pour charger globalement (à restreindre ensuite).
 */
function ballou_enqueue_vite_assets($pages = [])
{
    // Évite les doubles enqueues si ce helper est appelé plusieurs fois
    static $already_enqueued = false;
    if ($already_enqueued) return;

    $manifest = ballou_vite_manifest();
    if (!$manifest || (empty($manifest['js']) && empty($manifest['css']))) {
        if (defined('WP_DEBUG') && WP_DEBUG) error_log('[Vite Enqueue] No manifest or empty assets.');
        return;
    }

    // Si pages précisées : ne charger que sur ces pages WP
    $is_on_pages = empty($pages) || is_page($pages);
    if (!$is_on_pages) {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[Vite Enqueue] Skip – not target page(s): ' . (is_array($pages) ? implode(', ', $pages) : (string)$pages));
        }
        return;
    }

    $theme_uri  = trailingslashit(get_stylesheet_directory_uri());
    $local_dir  = trailingslashit(get_stylesheet_directory());

    // ------------------------------
    // 1) CSS (tous)
    // ------------------------------
    if (!empty($manifest['css'])) {
        $i = 0;
        foreach ($manifest['css'] as $css_url) {
            $local_css_path = str_replace($theme_uri, $local_dir, $css_url);
            $version = file_exists($local_css_path) ? (string) filemtime($local_css_path) : null;

            wp_enqueue_style(
                'ballou-vite-css-' . $i++,
                $css_url,
                [],
                $version
            );
        }
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[Vite Enqueue] Enqueued CSS: ' . count($manifest['css']));
        }
    }

    // ------------------------------
    // 2) JS principal (entry)
    // ------------------------------
    if (!empty($manifest['js'][0])) {
        $main_js   = $manifest['js'][0];
        $js_handle = 'ballou-vite-main';

        $local_js_path = str_replace($theme_uri, $local_dir, $main_js);
        $version = file_exists($local_js_path) ? (string) filemtime($local_js_path) : null;

        // Enqueue en footer, ES modules
        wp_enqueue_script(
            $js_handle,
            $main_js,
            [],
            $version,
            true  // Footer
        );

        // ← FIX : Garantir <script type="module"> (WP 5.7+)
        wp_script_add_data($js_handle, 'type', 'module');

        // ← FIX : Backup filter pour forcer type="module" + crossorigin (ESM CORS pour chunks)
        // S'exécute seulement si ce handle
        add_filter('script_loader_tag', function ($tag, $handle, $src) use ($js_handle) {
            if ($handle !== $js_handle) return $tag;
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log('[Vite Enqueue] Forcing type="module" crossorigin for: ' . $src);
            }
            // Remplace <script par <script type="module" crossorigin
            return str_replace('<script', '<script type="module" crossorigin', $tag);
        }, 10, 3);

        // --------------------------
        // Injection AVANT le module
        // --------------------------
        $rest_url   = rtrim((string) rest_url(), '/');      // .../wp-json
        $home_url   = trailingslashit(home_url('/'));       // .../ (avec / final)
        $ajax_url   = admin_url('admin-ajax.php');
        $rest_nonce = wp_create_nonce('wp_rest');            // le bon nonce pour l'API REST

        // 2.1 API base générique (utilisée par ton TS via apiBase())
        wp_add_inline_script(
            $js_handle,
            'window.BALLOU_API_BASE = ' . wp_json_encode($rest_url) . ';',
            'before'
        );

        // 2.2 Bases REST *nommées* + nonce + urls utiles (ajout homeUrl pour cohérence log)
        $rest_base_site   = trailingslashit(get_rest_url(null, 'site-info/v1'));
        $rest_base_ballou = trailingslashit(get_rest_url(null, 'ballou/v1'));

        wp_add_inline_script(
            $js_handle,
            'window.__BALLOU__ = Object.assign(window.__BALLOU__ || {}, {' .
                ' restBaseSite: '   . wp_json_encode($rest_base_site)   . ',' .
                ' restBaseBallou: ' . wp_json_encode($rest_base_ballou) . ',' .
                ' home: '           . wp_json_encode($home_url)         . ',' .
                ' homeUrl: '        . wp_json_encode($home_url)         . ',' .
                ' ajaxUrl: '        . wp_json_encode($ajax_url)         . ',' .
                ' nonce: "'         . esc_js($rest_nonce)               . '"'  .
                '}); if (typeof console !== "undefined" && console.log) { console.log("[Vite Inline] REST bases OK:", window.__BALLOU__); }',
            'before'
        );

        // 2.3 Globals additionnels (facultatif, via localize)
        wp_localize_script($js_handle, '__BALLOU_GLOBALS__', [
            'restUrl'  => esc_url($rest_url . '/'),
            'homeUrl'  => esc_url($home_url),
            'ajaxUrl'  => $ajax_url,
            'isDebug'  => (bool) (defined('WP_DEBUG') && WP_DEBUG),
        ]);

        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[Vite Enqueue] Loaded JS: ' . $main_js . ' | Local path: ' . $local_js_path . ' | Version: ' . ($version ?: 'n/a') . ' | Nonce: ' . $rest_nonce);
        }
    } else {
        if (defined('WP_DEBUG') && WP_DEBUG) error_log('[Vite Enqueue] No main JS in manifest.');
    }

    $already_enqueued = true;
}

/**
 * Hook d’enqueue (par défaut: global pour tests).
 * Après validation, remplacez par :
 *   add_action('wp_enqueue_scripts', fn() => ballou_enqueue_vite_assets(['contact', 'panier']));
 */
add_action('wp_enqueue_scripts', function () {
    // Global (à restreindre ensuite aux pages utiles)
    ballou_enqueue_vite_assets([]); // [] = global
}, 20);

/**
 * Helper à appeler depuis un template pour forcer l’enqueue si nécessaire.
 * Idempotent : ne s’exécute qu’une fois.
 */
function ballou_maybe_enqueue_vite()
{
    static $enqueued = false;
    if ($enqueued) return;
    ballou_enqueue_vite_assets([]);
    $enqueued = true;
}
