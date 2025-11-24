import React, { useState } from 'react';

interface Props {
    imageUrls: string[];
    images: number[]; // Optional: Keep for future Woo ID-based logic
}

const Gallery: React.FC<Props> = ({ imageUrls }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const totalImages = imageUrls.length;

    if (totalImages === 0) {
        return <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">Aucune image disponible</div>;
    }

    const nextSlide = () => setCurrentIndex((prev) => (prev === totalImages - 1 ? 0 : prev + 1));
    const prevSlide = () => setCurrentIndex((prev) => (prev === 0 ? totalImages - 1 : prev - 1));
    const goToSlide = (index: number) => setCurrentIndex(index);

    const isSingleImage = totalImages === 1;
    const showControls = !isSingleImage;

    return (
        <div className="product-media relative w-full max-w-md mx-auto"> {/* Reduced max-w for smaller display */}
            {/* Main Image - Reduced height for smaller view */}
            <img
                src={imageUrls[currentIndex]}
                alt={`Image du produit ${currentIndex + 1}`}
                className="w-full h-64 object-cover rounded-lg shadow-lg" // h-64 for reduced size; use h-48 for even smaller
                loading="lazy"
            />

            {/* Navigation Arrows - Hidden for single image */}
            {showControls && (
                <>
                    <button
                        onClick={prevSlide}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all z-10"
                        aria-label="Image précédente"
                    >
                        <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={nextSlide}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all z-10"
                        aria-label="Image suivante"
                    >
                        <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </>
            )}

            {/* Thumbnail Dots - Optional, for multi-image navigation; hidden for single */}
            {showControls && totalImages > 1 && (
                <div className="flex justify-center mt-4 space-x-2">
                    {imageUrls.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`w-2 h-2 rounded-full transition-colors ${index === currentIndex ? 'bg-[#e94e1b]' : 'bg-gray-300'
                                }`}
                            aria-label={`Aller à l'image ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Gallery;