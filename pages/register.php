<?php
/*
* Template Name: Page Register Ballou
*/
get_header();
?>

<div id="register-page" data-island="register">
    <!-- ✅ Fallback si JavaScript désactivé -->
    <div class="p-6 max-w-sm mx-auto bg-white shadow-md rounded-md mt-12">
        <h2 class="text-2xl font-semibold text-center mb-4" style="color: var(--brand-primary);">
            Créer un compte
        </h2>
        <p class="text-center text-sm text-gray-600 mb-6">
            Inscrivez-vous pour accéder à votre espace personnel et suivre vos commandes.
        </p>

        <form action="<?php echo esc_url(site_url('/wp-json/ballou/v1/register')); ?>" method="post" class="space-y-4">
            <input
                type="text"
                name="username"
                class="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Nom d'utilisateur"
                required />

            <input
                type="email"
                name="email"
                class="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Adresse e-mail"
                required />

            <input
                type="password"
                name="password"
                class="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Mot de passe"
                required />

            <input
                type="password"
                name="password_confirm"
                class="w-full p-2 border border-gray-300 rounded-md"
                placeholder="Confirmer le mot de passe"
                required />

            <!-- ✅ Bouton cohérent avec la charte Ballou -->
            <button
                type="submit"
                class="w-full py-2 rounded-md font-medium transition-colors duration-200"
                style="background-color: var(--brand-primary); color: var(--brand-light); cursor: pointer;"
                onmouseover="this.style.backgroundColor='white'; this.style.color='var(--brand-primary)';"
                onmouseout="this.style.backgroundColor='var(--brand-primary)'; this.style.color='var(--brand-light)';">
                S’inscrire
            </button>
        </form>

        <div class="text-center mt-4">
            <p class="text-sm text-gray-600">
                Déjà un compte ?
                <a href="<?php echo esc_url(wc_get_page_permalink('mon-compte')); ?>"
                    class="text-blue-600 font-medium hover:text-blue-800 transition">
                    Se connecter
                </a>
            </p>
        </div>
    </div>
</div>
<?php get_footer(); ?>