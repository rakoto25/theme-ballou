// assets/src/components/auth/LoginIsland.tsx (ajustez path si besoin)
import React, { useState } from "react";
import { login } from "../lib/login";

const LoginIsland: React.FC = () => {
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [rememberme, setRememberme] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Base path pour sous-répertoire (injecté via window ou Vite base)
    const basePath = window.BALLOU_BASE_PATH || ''; // Fallback vide si root

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username || !password) {
            setError("Tous les champs sont requis.");
            return;
        }

        const loginData = { username, password, rememberme };

        try {
            await login(loginData);
        } catch (error) {
            setError("Erreur lors de la connexion. Vérifiez vos identifiants.");
        }
    };

    return (
        <div className="p-6 max-w-sm mx-auto bg-white shadow-md rounded-md mt-12">
            <h2
                className="text-2xl font-semibold text-center mb-4 text-primary"
                style={{ color: 'var(--brand-primary, #29235c)' }}  /* Fallback inline pour h2 */
            >
                Connexion
            </h2>

            {error && <div className="text-red-600 text-center mb-4">{error}</div>}

            <form onSubmit={handleLogin} className="space-y-4">
                <input
                    type="text"
                    name="username"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    placeholder="Nom d'utilisateur"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    aria-label="Nom d'utilisateur"
                />

                <input
                    type="password"
                    name="password"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    placeholder="Mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aria-label="Mot de passe"
                />

                <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            name="rememberme"
                            className="h-4 w-4 accent-primary"  /* Accent bleu via CSS override */
                            checked={rememberme}
                            onChange={(e) => setRememberme(e.target.checked)}
                            aria-label="Se souvenir de moi"
                        />
                        <span className="text-sm text-muted">Se souvenir de moi</span>
                    </label>

                    {/* Lien mot de passe oublié avec base path */}
                    <a
                        href={`${basePath}/lost-password`}
                        className="text-sm text-primary hover:text-accent transition"
                    >
                        Mot de passe oublié ?
                    </a>
                </div>

                {/* Bouton : btn-primary + fallback inline (bleu → hover blanc/bleu via CSS) */}
                <button
                    type="submit"
                    className="w-full p-2 rounded-md font-medium border transition-colors duration-200 btn-primary"
                    style={{
                        // Fallback inline si Tailwind/Woo échoue (bleu charte)
                        backgroundColor: 'var(--brand-primary, #29235c)',
                        color: 'var(--brand-light, #ffffff)',
                        borderColor: 'var(--brand-primary, #29235c)',
                    }}
                    aria-label="Se connecter"
                >
                    Se connecter
                </button>
            </form>

            {/* Lien d'inscription avec base path */}
            <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                    Pas encore de compte ?{" "}
                    <a
                        href={`${basePath}/inscription`}
                        className="text-primary font-medium hover:text-accent transition"
                    >
                        S’inscrire
                    </a>
                </p>
            </div>
        </div>
    );
};

export default LoginIsland;