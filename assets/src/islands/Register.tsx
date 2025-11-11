// assets/src/components/auth/RegisterIsland.tsx (ajustez path si besoin)
import React, { useState } from "react";
import { register } from "../lib/register";

const RegisterIsland: React.FC = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Base path pour sous-répertoire (injecté via window ou Vite base)
    const basePath = window.BALLOU_BASE_PATH || ''; // Fallback vide si root

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!username || !email || !password || !confirmPassword) {
            setError("Tous les champs sont requis.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas.");
            return;
        }

        setLoading(true);
        try {
            const res = await register({ username, email, password });
            // Redirect géré dans register.ts ; success fallback si needed
            setSuccess(res.message || "Inscription réussie !");
            // Optionnel : clear fields (mais redirect immédiat)
            setUsername("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-sm mx-auto bg-white shadow-md rounded-md mt-12">
            <h2 className="text-2xl font-semibold text-center mb-4 text-primary">
                Créer un compte
            </h2>

            {error && <div className="text-red-600 text-center mb-4">{error}</div>}
            {success && <div className="text-green-600 text-center mb-4">{success}</div>}

            <form onSubmit={handleRegister} className="space-y-4">
                <input
                    type="text"
                    placeholder="Nom d’utilisateur"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    aria-label="Nom d'utilisateur"
                />

                <input
                    type="email"
                    placeholder="Adresse e-mail"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-label="Adresse e-mail"
                />

                <input
                    type="password"
                    placeholder="Mot de passe"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aria-label="Mot de passe"
                />

                <input
                    type="password"
                    placeholder="Confirmer le mot de passe"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    aria-label="Confirmer le mot de passe"
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full p-2 rounded-md font-medium border transition-colors duration-200 btn-primary"
                    style={{
                        // Fallback inline si Tailwind échoue (bleu charte + hover blanc)
                        backgroundColor: loading ? '#29235c' : 'var(--brand-primary, #29235c)',
                        color: loading ? '#ffffff' : 'var(--brand-light, #ffffff)',
                        borderColor: 'var(--brand-primary, #29235c)',
                        opacity: loading ? 0.5 : 1,
                        cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                    aria-label={loading ? "Création en cours" : "S’inscrire"}
                >
                    {loading ? "Création..." : "S’inscrire"}
                </button>
            </form>

            <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                    Déjà un compte ?{" "}
                    <a
                        href={`${basePath}/connexion`}
                        className="text-primary font-medium hover:text-accent transition"
                    >
                        Se connecter
                    </a>
                </p>
            </div>
        </div>
    );
};

export default RegisterIsland;