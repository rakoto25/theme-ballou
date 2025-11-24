import React, { useState, useRef, useEffect } from 'react';
import { addToCart, emitCartUpdated } from '../../lib/cart';
import { SimilarProductData, SimilarProductsProps } from '../../lib/similarproduct';

const SimilarProduct: React.FC<SimilarProductsProps> = ({ products = [] }) => {

    // Garde seulement max 12 produits en stock pour limiter
    const inStockProducts = products.filter(p => p.stock_status === "instock").slice(0, 12);
    if (inStockProducts.length === 0) return null;

    // Clonage pour boucle infinie (3x)
    const loopItems = [...inStockProducts, ...inStockProducts, ...inStockProducts];

    const sliderRef = useRef<HTMLDivElement>(null);
    const cardWidthRef = useRef(0);

    // Index initial au premier groupe "milieu" pour boucle infinie
    const [index, setIndex] = useState(inStockProducts.length);

    // Mesure largeur carte (avec gap 16)
    useEffect(() => {
        if (!sliderRef.current) return;
        const firstCard = sliderRef.current.querySelector(".card-item") as HTMLElement;
        if (firstCard) {
            cardWidthRef.current = firstCard.offsetWidth + 16; // gap-4 = 16px
        }
    }, []);

    // Correction de l'index pour boucle infinie
    useEffect(() => {
        const total = inStockProducts.length;
        if (index >= total * 2) {
            setTimeout(() => setIndex(total), 100);
        }
        if (index < total) {
            setTimeout(() => setIndex(total * 2 - 1), 100);
        }
    }, [index, inStockProducts.length]);

    // Avance/défilement
    const goNext = () => setIndex(i => Math.min(i + 1, loopItems.length - 1));
    const goPrev = () => setIndex(i => Math.max(i - 1, 0));

    // Rendu d'une carte produit
    const renderCard = (product: SimilarProductData) => {
        const [adding, setAdding] = useState(false);
        const [added, setAdded] = useState(false);

        const handleAdd = async (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (adding || product.stock_status !== 'instock') return;

            try {
                setAdding(true);
                await addToCart(product.id, 1);
                emitCartUpdated();
                setAdded(true);
            } finally {
                setAdding(false);
            }
        };

        return (
            <a
                key={product.id + Math.random()}
                href={product.permalink}
                className="card-item flex-shrink-0 w-48 bg-white rounded-lg border border-gray-300 shadow-sm hover:shadow-md transition-all"
            >
                <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                />
                <div className="p-3">
                    <h3 className="text-sm font-semibold text-[#1b1919] leading-tight break-words line-clamp-3 mb-1">
                        {product.title}
                    </h3>
                    <div
                        className="text-[#29235c] font-bold mb-2"
                        dangerouslySetInnerHTML={{ __html: product.price }}
                    />
                    <div className="flex items-center justify-between mt-2">
                        {product.sku ? (
                            <p className="text-xs text-gray-500">Ref: {product.sku}</p>
                        ) : (
                            <span></span>
                        )}
                        {!added ? (
                            <button
                                onClick={handleAdd}
                                disabled={adding}
                                className="text-xs font-semibold text-[#e94e1b] border border-[#e94e1b] rounded-full px-3 py-1 hover:bg-[#e94e1b]/10 transition"
                            >
                                {adding ? "Ajout..." : "Ajouter"}
                            </button>
                        ) : (
                            <a
                                href="/cart"
                                className="text-xs font-semibold bg-[#29235c] text-white px-3 py-1 rounded-full transition"
                            >
                                Voir
                            </a>
                        )}
                    </div>
                </div>
            </a>
        );
    };

    return (
        <div className="relative overflow-hidden">
            <div
                ref={sliderRef}
                className="flex gap-4 transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${-index * cardWidthRef.current}px)` }}
            >
                {loopItems.map(p => renderCard(p))}
            </div>

            <button
                onClick={goPrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-md"
            >
                ◀
            </button>

            <button
                onClick={goNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-md"
            >
                ▶
            </button>
        </div>
    );
};

export default SimilarProduct;