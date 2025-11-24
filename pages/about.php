<?php

/**
 * Template Name: Page À Propos Ballou (Hybride SEO + React)
 */

if (!defined('ABSPATH')) exit;

get_header();

// Chargement du bundle Vite pour les "islands" React
if (function_exists('ballou_maybe_enqueue_vite')) {
    ballou_maybe_enqueue_vite();
}

// Variables de base
$title           = get_the_title() ?: 'À propos de Ballou';
$site_name       = get_bloginfo('name');
$site_url        = home_url('/');
$contact_email   = 'contact@ballou.mg';
$phone           = '+261 34 17 340 22';
$showroom_address = 'Quartier des affaires Andraharo, Antananarivo, Madagascar';
$showroom_size   = '2 000 m²';

// Images (adaptées au thème)
$map_image      = get_template_directory_uri() . '/assets/images/Madagascar_Carte-Ballou.png';
$about_image    = get_template_directory_uri() . '/assets/images/SITE_PRINCIPALE.jpg';
$partners_image = get_template_directory_uri() . '/assets/images/DOS-Mise-En-Page-Logo.jpg';

// Texte Showroom
$showroom_text = 'Découvrez nos collections dans notre showroom spacieux de ' . $showroom_size . ' au cœur du quartier des affaires Andraharo, Antananarivo.';

// Contenu structuré passé à React
$content = [
    'intro' => 'Depuis plus de 60 ans, Ballou, votre spécialiste de l\'intérieur à Madagascar, sélectionne avec soin les meilleurs produits pour répondre à tous les styles et besoins : maison, hôtel, entreprise...',
    'history' => [
        'title' => 'Notre histoire',
        'text'  => 'Fondée en 1963 par M. Djaffaraly Meralli Ballou, notre aventure débute dans un modeste magasin de tissus de 12 m² à Analakely, Antananarivo. Naturellement, nous nous diversifions pour devenir leader en équipement de la maison à Madagascar. Aujourd’hui, portée par une équipe dynamique et passionnée, Ballou propose des articles d’Europe alliant qualité, design et adaptation parfaite à vos intérieurs.',
    ],
    'philosophy' => [
        'title' => 'Notre philosophie',
        'text'  => 'Guidés par notre slogan "Spécialiste d\'intérieur", nous anticipons les tendances, sélectionnons des produits haut de gamme au meilleur rapport qualité/prix, pour que vous puissiez créer un espace unique qui reflète votre personnalité.',
    ],
    'products' => [
        'title' => 'Nos univers produits',
        'text'  => 'Pour recevoir, offrir ou vous faire plaisir, découvrez nos grandes marques internationales : Maison du Monde, Pyrex, Luminarc, Pradel France, H. Koenig, Harper, Royalty Line, Bleu Câlin, Mollyflex, Today, Atmosphera, Asa Selection...',
        'features' => [
            'Créer un intérieur sur mesure avec meubles, décoration, revêtements de sol, films vitrages et stores.',
            'Affirmer votre style à table et dans la maison avec art de la table et linge.',
            'Cuisiner avec passion grâce à nos ustensiles et petit électroménager.',
            'Mieux dormir avec notre literie premium fabriquée en France et en Italie.',
            'Maîtriser la lumière via rideaux, voilages et stores, en jouant sur couleurs, matières et formes.',
        ],
    ],
    'coverage' => [
        'title' => 'Notre présence à Madagascar',
        'text'  => 'Ballou dessert la majorité des villes malgaches via un réseau de revendeurs dédiés. Que vous soyez particulier, décorateur, architecte, promoteur immobilier, hôtel ou entreprise, nous sommes à vos côtés.',
    ],
    'showroom' => [
        'title' => 'Visitez notre showroom',
        'text'  => $showroom_text,
    ],
];

$about_props = [
    'title'          => $title,
    'siteName'       => $site_name,
    'siteUrl'        => $site_url,
    'contactEmail'   => $contact_email,
    'phone'          => $phone,
    'showroomAddress' => $showroom_address,
    'showroomSize'   => $showroom_size,
    'mapImage'       => $map_image,
    'partnersImage'  => $partners_image,
    'aboutImage'     => $about_image,
    'content'        => $content,
];

// Contenu dynamique ACF optionnel
if (function_exists('get_field')) {
    $custom_section = get_field('about_custom_section');
    if ($custom_section) {
        $about_props['customContent'] = $custom_section; // HTML ou texte enrichi
    }
}
?>

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
    <!-- Header SEO invisible mais sémantique -->


    <!-- Îlot React -->
    <section
        data-island="about"
        data-props='<?php echo esc_attr(wp_json_encode($about_props)); ?>'>
        <div class="island-root"></div>
    </section>

    <noscript>
        <!-- Fallback statique SEO / accessibilité -->
        <article class="mt-10 space-y-14">
            <!-- HERO simplifié -->
            <section class="relative overflow-hidden rounded-3xl bg-[#29235c] text-white shadow-xl">
                <div class="absolute inset-0 bg-gradient-to-r from-[rgba(0,0,0,0.55)] via-[rgba(0,0,0,0.3)] to-transparent"></div>
                <div class="relative grid md:grid-cols-2 gap-10 px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
                    <div class="space-y-5 z-10">
                        <p class="text-xs uppercase tracking-[0.25em] text-[#e94e1b]">
                            Spécialiste d’intérieur depuis 1963
                        </p>
                        <h1 class="text-3xl sm:text-4xl font-bold leading-tight">
                            <?php echo esc_html($about_props['title']); ?>
                        </h1>
                        <p class="text-base sm:text-lg text-white/90 max-w-xl">
                            <?php echo esc_html($about_props['content']['intro']); ?>
                        </p>
                        <p class="text-sm text-white/80">
                            Showroom : <?php echo esc_html($about_props['showroomAddress']); ?> – <?php echo esc_html($about_props['showroomSize']); ?>
                        </p>
                        <div class="flex flex-wrap gap-3 mt-4">
                            <a href="/contact" class="px-6 py-3 bg-white text-[#29235c] font-semibold rounded-full hover:bg-gray-100 transition-all shadow-lg">
                                Nous contacter
                            </a>
                            <a href="tel:<?php echo esc_attr($phone); ?>" class="px-6 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-[#29235c] transition-all">
                                Appeler maintenant
                            </a>
                        </div>
                    </div>
                    <div class="hidden md:flex items-center justify-end">
                        <img
                            src="<?php echo esc_url($about_props['aboutImage']); ?>"
                            alt="Marques et partenaires Ballou"
                            class="w-full max-w-sm rounded-2xl shadow-xl object-cover border-8 border-white/20"
                            loading="lazy" />
                    </div>
                </div>
            </section>

            <!-- HISTOIRE -->
            <section>
                <div class="flex items-center mb-8">
                    <div class="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                    <h2 class="text-2xl sm:text-3xl font-bold ml-4 text-[#29235c]">
                        <?php echo esc_html($about_props['content']['history']['title']); ?>
                    </h2>
                </div>
                <div class="grid lg:grid-cols-2 gap-8 items-center">
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p class="text-base sm:text-lg text-[#1b1919] leading-relaxed">
                            <?php echo esc_html($about_props['content']['history']['text']); ?>
                        </p>
                    </div>
                    <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <div class="flex items-center gap-4 mb-4">
                            <div class="w-12 h-12 rounded-full bg-[#29235c] flex items-center justify-center text-white font-bold">1963</div>
                            <h3 class="text-xl font-semibold text-[#29235c]">Début de l'aventure</h3>
                        </div>
                        <p class="text-sm text-[#1b1919]/80">
                            Un modeste magasin de tissus de 12 m² à Analakely, Antananarivo
                        </p>
                    </div>
                </div>
            </section>

            <!-- PHILOSOPHIE -->
            <section class="bg-gradient-to-br from-gray-50 to-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div class="flex items-center mb-6">
                    <div class="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                    <h2 class="text-2xl sm:text-3xl font-bold ml-4 text-[#29235c]">
                        <?php echo esc_html($about_props['content']['philosophy']['title']); ?>
                    </h2>
                </div>
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p class="text-base sm:text-lg text-[#1b1919] leading-relaxed">
                        <?php echo esc_html($about_props['content']['philosophy']['text']); ?>
                    </p>
                </div>
            </section>

            <!-- PRODUITS -->
            <section>
                <div class="flex items-center mb-8">
                    <div class="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                    <h2 class="text-2xl sm:text-3xl font-bold ml-4 text-[#29235c]">
                        <?php echo esc_html($about_props['content']['products']['title']); ?>
                    </h2>
                </div>
                <p class="text-base sm:text-lg text-[#1b1919] leading-relaxed mb-6">
                    <?php echo esc_html($about_props['content']['products']['text']); ?>
                </p>

                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <?php foreach ($about_props['content']['products']['features'] as $feature) : ?>
                        <div class="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-5 shadow-sm hover:shadow-md transition-all">
                            <span class="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e94e1b]/10 text-[#e94e1b]">
                                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                </svg>
                            </span>
                            <p class="text-sm text-[#1b1919] leading-relaxed">
                                <?php echo esc_html($feature); ?>
                            </p>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>

            <!-- COUVERTURE -->
            <section class="grid lg:grid-cols-2 gap-10 items-center">
                <div>
                    <div class="flex items-center mb-6">
                        <div class="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                        <h2 class="text-2xl sm:text-3xl font-bold ml-4 text-[#29235c]">
                            <?php echo esc_html($about_props['content']['coverage']['title']); ?>
                        </h2>
                    </div>
                    <p class="text-base sm:text-lg text-[#1b1919] leading-relaxed">
                        <?php echo esc_html($about_props['content']['coverage']['text']); ?>
                    </p>
                    <div class="mt-6 grid grid-cols-2 gap-4">
                        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div class="text-3xl font-bold text-[#29235c]">60+</div>
                            <div class="text-sm text-[#1b1919]/80">Années d'expérience</div>
                        </div>
                        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div class="text-3xl font-bold text-[#29235c]">Europe</div>
                            <div class="text-sm text-[#1b1919]/80">Origine des produits</div>
                        </div>
                    </div>
                </div>
                <div class="space-y-4">
                    <img
                        src="<?php echo esc_url($about_props['mapImage']); ?>"
                        alt="Carte de Madagascar avec les points Ballou"
                        class="w-full h-80 object-contain rounded-2xl shadow-lg border-4 border-white" // Same changes as above
                        loading="lazy" />
                    <p class="text-xs text-[#1b1919]/80 text-center">
                        Ballou accompagne particuliers et professionnels dans la majorité des grandes villes de Madagascar.
                    </p>
                </div>
            </section>

            <!-- SHOWROOM -->
            <section class="rounded-3xl bg-[#29235c] p-8 text-white shadow-xl">
                <div class="flex items-center mb-6">
                    <div class="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                    <h2 class="text-2xl sm:text-3xl font-bold ml-4">
                        <?php echo esc_html($about_props['content']['showroom']['title']); ?>
                    </h2>
                </div>
                <div class="grid lg:grid-cols-2 gap-8 items-center">
                    <div>
                        <p class="text-base sm:text-lg text-white/90 leading-relaxed mb-4">
                            <?php echo esc_html($about_props['content']['showroom']['text']); ?>
                        </p>
                        <div class="space-y-3 text-sm">
                            <div>
                                <span class="font-semibold">Adresse : </span>
                                <?php echo esc_html($about_props['showroomAddress']); ?>
                            </div>
                            <div>
                                <span class="font-semibold">Surface : </span>
                                <?php echo esc_html($about_props['showroomSize']); ?>
                            </div>
                        </div>
                        <div class="mt-6 flex flex-wrap gap-3">
                            <a href="/contact" class="px-6 py-3 bg-white text-[#29235c] font-semibold rounded-full hover:bg-gray-100 transition-all">
                                Prendre rendez-vous
                            </a>
                            <a href="#" class="px-6 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-[#29235c] transition-all">
                                Découvrir nos univers
                            </a>
                        </div>
                    </div>
                    <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <img
                            src="<?php echo esc_url($about_props['partnersImage']); ?>"
                            alt="Marques et partenaires Ballou"
                            class="w-full rounded-xl object-cover"
                            loading="lazy" />
                    </div>
                </div>
            </section>

            <?php if (isset($about_props['customContent'])) : ?>
                <section class="rounded-3xl bg-white border border-gray-100 p-6 sm:p-8">
                    <?php echo $about_props['customContent']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped 
                    ?>
                </section>
            <?php endif; ?>

            <footer class="border-t border-gray-200 pt-6 text-center text-sm text-[#1b1919]/80">
                <p>Rejoignez-nous pour transformer vos espaces !</p>
                <p class="mt-2">
                    Contact : <?php echo esc_html($about_props['phone']); ?> — <?php echo esc_html($about_props['contactEmail']); ?>
                </p>
            </footer>
        </article>
    </noscript>

    <!-- JSON-LD Organization -->
    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "<?php echo esc_attr($site_name); ?>",
            "url": "<?php echo esc_url($site_url); ?>",
            "description": "<?php echo esc_attr($content['intro']); ?>",
            "contactPoint": {
                "@type": "ContactPoint",
                "telephone": "<?php echo esc_attr($phone); ?>",
                "contactType": "customer service",
                "email": "<?php echo esc_attr($contact_email); ?>"
            },
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "Quartier des affaires Andraharo",
                "addressLocality": "Antananarivo",
                "addressCountry": "MG"
            },
            "founder": {
                "@type": "Person",
                "name": "Djaffaraly Meralli Ballou"
            },
            "foundingDate": "1963"
        }
    </script>
</main>

<?php get_footer(); ?>