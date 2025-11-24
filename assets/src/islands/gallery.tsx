import React, { useState, useEffect } from 'react';

interface Props {
    images?: number[];
    imageUrls?: string[]; // NOUVEAU : Full URLs directes depuis PHP
}

const Gallery: React.FC<Props> = ({ images = [], imageUrls = [] }) => {
    const [displayImages, setDisplayImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0); // NOUVEAU : État pour le slider

    useEffect(() => {
        console.log('Gallery props:', { images, imageUrls }); // DEBUG : Vérifiez console F12

        const loadImages = async () => {
            try {
                let urls: string[] = [];

                // PRIORITÉ : Utilise imageUrls directes depuis PHP (full URLs, no fetch)
                if (imageUrls.length > 0) {
                    urls = imageUrls.filter(url => url); // Filtre vides
                }
                // Fallback : Fetch si pas d'URLs (compat ancien)
                else if (images.length > 0) {
                    urls = await Promise.all(
                        images.map(async (id) => {
                            const response = await fetch(`/wp-json/wp/v2/media/${id}`);
                            if (response.ok) {
                                const media = await response.json();
                                return media.source_url || `/wp-content/uploads/${id}`; // Fallback mieux (mais rare)
                            }
                            console.warn(`Media ID ${id} non trouvé`); // Log warning
                            return null; // Skip broken
                        })
                    );
                    urls = urls.filter(url => url); // Filtre nulls
                }

                // Si toujours vide, force default
                if (urls.length === 0) {
                    const defaultImage = '/wp-content/themes/ballou-update/assets/images/default-product.jpg';
                    urls = [defaultImage];
                }

                setDisplayImages(urls);
                // NOUVEAU : Reset index si images changent
                setCurrentIndex(0);
            } catch (error) {
                console.error('Erreur chargement images galerie:', error);
                // Ultimate fallback : Default si tout fail
                setDisplayImages(['/wp-content/themes/ballou-update/assets/images/default-product.jpg']);
            } finally {
                setLoading(false);
            }
        };

        loadImages();
    }, [images, imageUrls]);

    const totalImages = displayImages.length;
    const isSingleImage = totalImages <= 1; // NOUVEAU : Détecte single pour désactiver slider

    // NOUVEAU : Fonctions slider
    const nextSlide = () => setCurrentIndex((prev) => (prev === totalImages - 1 ? 0 : prev + 1));
    const prevSlide = () => setCurrentIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1));
    const goToSlide = (index: number) => setCurrentIndex(index);

    const defaultImage = '/wp-content/themes/ballou-update/assets/images/default-product.jpg'; // Assurez ce fichier existe

    if (loading) {
        return <div className="product-media h-48 bg-gray-200 flex items-center justify-center rounded">Chargement des images...</div>;
    }

    // NOUVEAU : Image principale (toujours la current pour slider)
    const mainImage = (
        <img
            key={currentIndex} // Key pour re-render
            src={displayImages[currentIndex] || defaultImage}
            alt={`Image produit ${currentIndex + 1}`}
            className="w-full h-48 object-cover rounded" // Gardé h-48 pour taille réduite; changez à h-64 si besoin
            onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIGF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';
                target.alt = 'Image non disponible';
            }}
        />
    );

    return (
        <div className="product-media relative w-full max-w-sm mx-auto space-y-2"> {/* NOUVEAU : max-w-sm pour réduire largeur; mx-auto pour centrage */}
            <div className="relative"> {/* Conteneur pour l'image principale + flèches */}
                {mainImage}

                {/* NOUVEAU : Flèches navigation (cachées pour single image) */}
                {!isSingleImage && (
                    <>
                        <button
                            onClick={prevSlide}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md transition-all z-10 opacity-0 group-hover:opacity-100" // Hover pour visibilité
                            aria-label="Image précédente"
                        >
                            <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={nextSlide}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md transition-all z-10 opacity-0 group-hover:opacity-100"
                            aria-label="Image suivante"
                        >
                            <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {/* NOUVEAU : Dots pour navigation (optionnel, caché pour single; petit pour compacité) */}
            {!isSingleImage && totalImages > 1 && (
                <div className="flex justify-center space-x-1">
                    {displayImages.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${index === currentIndex ? 'bg-[#e94e1b]' : 'bg-gray-300'
                                }`}
                            aria-label={`Aller à l'image ${index + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* ANCIEN : Stack vertical → Remplacé par slider; gardé pour compat si besoin, mais commentez */}
            {/* {displayImages.map((url, i) => ( ... ))} */}
        </div>
    );
};

export default Gallery;