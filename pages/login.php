<?php
/*
*Template Name: Page Login ballou
*/
get_header();
?>

<div id="login-page" data-island="login">
    <!-- Fallback pour React -->
    <div class="p-6 max-w-sm mx-auto bg-white shadow-md rounded-md">
        <h2 class="text-2xl font-semibold text-center mb-4">Connexion</h2>
        <p class="text-center text-sm text-gray-600">Veuillez vous connecter pour accéder à votre compte.</p>
        <div id="login-fallback">
            <!-- Contenu temporaire pour les utilisateurs qui n'ont pas JavaScript ou si l'Island React ne fonctionne pas -->
            <form action="<?php echo esc_url(wc_get_account_endpoint_url('login')); ?>" method="post" class="space-y-4">
                <input type="text" name="username" class="w-full p-2 border border-gray-300 rounded-md" placeholder="Nom d'utilisateur" required>
                <input type="password" name="password" class="w-full p-2 border border-gray-300 rounded-md" placeholder="Mot de passe" required>
                <button type="submit" class="w-full py-2 bg-blue-500 text-white rounded-md">Se connecter</button>
                <div class="flex items-center justify-between">
                    <label class="flex items-center space-x-2">
                        <input type="checkbox" name="rememberme" class="h-4 w-4 text-blue-500">
                        <span class="text-sm text-gray-600">Se souvenir de moi</span>
                    </label>
                    <a href="<?php echo wp_lostpassword_url(); ?>" class="text-sm text-blue-500">Mot de passe oublié ?</a>
                </div>
            </form>
        </div>
    </div>
</div>

<?php get_footer(); ?>