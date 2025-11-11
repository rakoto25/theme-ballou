<?php

/**
 * Template de page d’accueil Ballou (SEO: contenu serveur + îlots React)
 */
if (!defined('ABSPATH')) exit;
get_header();

/**
 * =========================
 * 1) SECTION HERO (seule)
 * =========================
 *
 * IMPORTANT :
 *  - Passe l’ID du slider CPT (créé via ton plugin) dans data-props → "sliderId"
 *  - "apiBaseUrl" peut être omis si le front et WP sont sur la même origine.
 */
$slider_id  = 1214; // ← Remplace par l’ID réel de ton slider
$hero_props = [
    'sliderId'   => $slider_id,
    'apiBaseUrl' => home_url(), // ex: http://localhost/ballou ; retire cette ligne si même origine
    // Tu peux ajouter d'autres props optionnelles attendues par <Hero /> :
    // 'imageSize'  => 'large',
    // 'intervalMs' => 6000,
];

// Fallback SEO serveur (image statique + texte)
// NB : ce fallback s'affiche avant l'hydratation React, et reste utile pour le SEO.
$f_img  = get_theme_file_uri('assets/img/hero/placeholder-hero.jpg');
$f_tit  = get_bloginfo('name');
$f_sub  = get_bloginfo('description');
$f_href = home_url('/nouveautes');
?>
<section class="relative">
    <!-- Îlot React: HERO -->
    <div
        data-island="hero"
        data-props='<?php echo esc_attr(wp_json_encode($hero_props)); ?>'>
        <!-- Fallback serveur SEO-friendly -->
        <div class="relative">
            <img
                src="<?php echo esc_url($f_img); ?>"
                alt="<?php echo esc_attr($f_tit); ?>"
                class="h-auto w-full object-cover"
                loading="eager"
                fetchpriority="high" />
            <div class="container mx-auto px-4 py-10">
                <h1 class="text-2xl font-bold text-zinc-900 md:text-4xl">
                    <?php echo esc_html($f_tit); ?>
                </h1>
                <p class="mt-2 max-w-2xl text-zinc-700">
                    <?php echo esc_html($f_sub); ?>
                </p>
                <a
                    href="<?php echo esc_url($f_href); ?>"
                    class="mt-5 inline-flex items-center rounded-full bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400">
                    Découvrir
                </a>
            </div>
        </div>
    </div>
</section>

<?php
/**
 * ==============================
 * 2) SECTION BESTSELLERS (seule)
 * ==============================
 * Fallback serveur : top ventes via total_sales (rapide et SEO-friendly).
 * L’îlot React “bestsellers” hydratera ensuite pour enrichir (carrousel, etc.).
 */

// Query serveur pour fallback SEO
$best_q = new WP_Query([
    'post_type'      => 'product',
    'posts_per_page' => 12,
    'post_status'    => 'publish',
    'meta_key'       => 'total_sales',
    'orderby'        => 'meta_value_num',
    'order'          => 'DESC',
]);

// Préparation JSON-LD ItemList/Product (SEO)
$items_ld = [];
?>
<section class="relative mx-auto max-w-7xl px-4 py-10">

    <!-- Îlot React: BESTSELLERS -->
    <div
        data-island="bestsellers"
        data-props='<?php echo esc_attr(wp_json_encode([
                        "title" => "Nos meilleures ventes",
                        "subtitle" => "Pièces plébiscitées par nos clients",
                        "limit" => 12,
                        "days" => 30,
                        "category" => null,
                        "includeVariations" => false,
                    ])); ?>'>

        <!-- Fallback serveur SEO-friendly -->
        <?php if ($best_q->have_posts()): ?>
            <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                <?php
                while ($best_q->have_posts()) : $best_q->the_post();
                    global $product;
                    if (!$product instanceof WC_Product) continue;

                    $href  = get_permalink();
                    $title = get_the_title();
                    $img   = get_the_post_thumbnail_url(get_the_ID(), 'medium') ?: wc_placeholder_img_src('medium');
                    $price = (float) $product->get_price();
                    $cur   = get_woocommerce_currency();

                    $items_ld[] = [
                        'href'  => $href,
                        'title' => $title,
                        'img'   => $img,
                        'price' => $price,
                        'cur'   => $cur,
                    ];
                ?>
                    <article class="group overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-[2px] hover:shadow-md">
                        <a href="<?php echo esc_url($href); ?>" class="block" aria-label="<?php echo esc_attr($title); ?>">
                            <img
                                src="<?php echo esc_url($img); ?>"
                                alt="<?php echo esc_attr($title); ?>"
                                loading="lazy"
                                class="h-56 w-full object-cover transition group-hover:scale-[1.02]" />
                        </a>
                        <div class="p-3">
                            <h3 class="line-clamp-1 text-sm font-semibold text-zinc-900">
                                <a href="<?php echo esc_url($href); ?>" class="hover:underline">
                                    <?php echo esc_html($title); ?>
                                </a>
                            </h3>
                            <div class="mt-1 text-base font-bold text-zinc-900">
                                <?php echo wp_kses_post($product->get_price_html()); ?>
                            </div>
                        </div>
                    </article>
                <?php endwhile;
                wp_reset_postdata(); ?>
            </div>
        <?php else: ?>
            <div class="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-600">
                Aucune sélection pour le moment.
            </div>
        <?php endif; ?>
    </div>

    <?php
    // JSON-LD pour la section Bestsellers (ItemList + Product)
    if (!empty($items_ld)) {
        $json_ld = [
            "@context" => "https://schema.org",
            "@type"    => "ItemList",
            "itemListElement" => array_map(function ($p, $i) {
                return [
                    "@type"    => "ListItem",
                    "position" => $i + 1,
                    "url"      => $p['href'],
                    "item"     => [
                        "@type"  => "Product",
                        "name"   => $p['title'],
                        "image"  => $p['img'],
                        "offers" => [
                            "@type"         => "Offer",
                            "price"         => $p['price'],
                            "priceCurrency" => $p['cur'],
                            "availability"  => "https://schema.org/InStock",
                        ],
                    ],
                ];
            }, $items_ld, array_keys($items_ld)),
        ];
        echo '<script type="application/ld+json">' . wp_json_encode($json_ld) . '</script>';
    }
    ?>
</section>

<section class="our-select">
    <div
        data-island="oursselect"
        data-props='{"title":"Notre sélection du mois","subtitle":"Coup de cœur de l’équipe","limit":12,"tag":"selection-du-mois"}'></div>
</section>

<div class="best-category">
    <div
        data-island="bestcategory"
        data-props='{"limit":12,"orderby":"name","order":"ASC"}'></div>
</div>
<?php get_footer(); ?>