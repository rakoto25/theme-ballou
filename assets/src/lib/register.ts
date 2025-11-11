import axios from 'axios';

const apiBase = window.BALLOU_API_BASE; // URL API via Vite (e.g., 'http://localhost/ballou')

// Déduire base path frontend depuis apiBase (sans /wp-json)
const getFrontendBase = () => {
    return apiBase.replace(/\/wp-json.*$/, ''); // e.g., 'http://localhost/ballou' → 'http://localhost/ballou'
};

export interface RegisterData {
    username: string;
    email: string;
    password: string;
}

export async function register(data: RegisterData) {
    try {
        // Log pour debug
        console.log(`Calling register API at: ${apiBase}/ballou/v1/register`);

        const response = await axios.post(`${apiBase}/ballou/v1/register`, data, {
            headers: {
                'Content-Type': 'application/json',
            },
            withCredentials: true, // Pour cookies WP si needed
        });

        if (response.status === 200 || response.status === 201) {
            // Redirige vers "Mon Compte" après inscription (auth cookie set en PHP)
            const basePath = getFrontendBase();
            window.location.href = `${basePath}/mon-compte`;
            return response.data; // { success: true, message: '...', user_id: ... }
        } else {
            throw new Error(response.data?.error || 'Erreur d’inscription.');
        }
    } catch (error: any) {
        // Si erreur réseau/404 (HTML), log et throw générique
        if (error.response && error.response.status >= 400) {
            const data = error.response.data;
            // Check si HTML (404 WP)
            if (typeof data === 'string' && data.includes('<!DOCTYPE')) {
                console.error('API returned HTML (likely 404):', data.substring(0, 200));
                throw new Error('Endpoint non trouvé. Vérifiez la configuration WP.');
            }
            throw new Error(data?.error || data?.message || 'Erreur d’inscription.');
        }
        console.error('Register error:', error);
        throw new Error('Erreur serveur lors de l’inscription.');
    }
}