import React, { useState, useEffect } from 'react';

interface Props {
    images?: number[];
    imageUrls?: string[]; // NOUVEAU : Full URLs directes depuis PHP
}

const Gallery: React.FC<Props> = ({ images = [], imageUrls = [] }) => {
    const [displayImages, setDisplayImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

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

    const defaultImage = '/wp-content/themes/ballou-update/assets/images/default-product.jpg'; // Assurez ce fichier existe

    if (loading) {
        return <div className="product-media h-48 bg-gray-200 flex items-center justify-center rounded">Chargement des images...</div>;
    }

    return (
        <div className="product-media space-y-2">
            {displayImages.map((url, i) => (
                <img
                    key={i}
                    src={url}
                    alt={`Image produit ${i + 1}`}
                    className="w-full h-48 object-cover rounded"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIGF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';
                        target.alt = 'Image non disponible';
                    }}
                />
            ))}
        </div>
    );
};

export default Gallery;