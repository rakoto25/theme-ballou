import axios from 'axios';

const apiBase = window.BALLOU_API_BASE; // URL de l'API de base via Vite

interface LoginData {
    username: string;
    password: string;
    rememberme: boolean;
}

export const login = async (data: LoginData) => {
    try {
        // Log pour vérifier l'URL de l'API
        console.log(`Calling API at: ${apiBase}/wp/v2/auth/login`);

        const response = await axios.post(`${apiBase}/wp/v2/auth/login`, data, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (response.status === 200) {
            window.location.href = "/mon-compte"; // Redirige vers la page "Mon Compte" après connexion réussie
        } else {
            throw new Error('Échec de la connexion');
        }
    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        alert('Erreur de connexion, veuillez vérifier vos informations.');
    }
};