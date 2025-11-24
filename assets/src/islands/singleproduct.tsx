import React, { useEffect, useState } from 'react';
import { ProductData, fetchProduct } from '../lib/singleproduct';
import { addToCart, getCartUrl, emitCartUpdated } from '../lib/cart'; // Ajustez chemin si besoin

interface Props {
    id?: number;
    slug?: string;
    title?: string;
    price?: string;
    description?: string;
    dimensions?: string;
    images?: number[];
    add_to_cart_url?: string;
    stock_status?: string;
    sku?: string;  // NOUVEAU : Ajout du SKU dans les props
    meta?: Record<string, any>;
}

const SingleProduct: React.FC<Props> = ({
    id, slug: initialSlug, title: initialTitle, price: initialPrice,
    description: initialDescription, dimensions: initialDimensions,
    images: initialImages, add_to_cart_url: initialAddToCartUrl, stock_status,
    sku: initialSku  // NOUVEAU : Récupération du SKU
}) => {
    const [product, setProduct] = useState<ProductData | null>(null);
    const [loading, setLoading] = useState(true);
    // States pour bouton (comme ProductCard)
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    // Parse slug depuis URL si absent (ex. : /ballou/produit/slug/ → 'slug')
    const urlSlug = initialSlug || window.location.pathname.split('/').pop()?.replace(/[^a-z0-9-]/gi, '') || '';

    // Hydratation produit (images gérées par gallery island séparée)
    useEffect(() => {
        const loadProduct = async () => {
            try {
                if (initialTitle && initialPrice) {
                    // Hydratation avec props PHP
                    setProduct({
                        id: id || 0,
                        slug: initialSlug || '',
                        title: initialTitle,
                        price: initialPrice,
                        description: initialDescription || '',
                        dimensions: initialDimensions,
                        images: initialImages || [],
                        add_to_cart_url: initialAddToCartUrl,
                        stock_status: stock_status || 'instock',
                        sku: initialSku || '',  // NOUVEAU : Hydratation du SKU
                    });
                } else {
                    // Fallback API si props incomplets
                    const fetched = await fetchProduct(urlSlug);
                    setProduct(fetched);
                }
            } catch (error) {
                console.error('Erreur chargement produit:', error);
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [initialSlug, initialTitle, initialPrice, initialDescription, initialDimensions, initialImages, initialAddToCartUrl, stock_status, initialSku, urlSlug]);  // NOUVEAU : Ajout de initialSku dans les dépendances

    // Handler ajout (comme ProductCard : API + event pour badge update)
    async function handleAdd(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        if (adding || !product || product.stock_status !== 'instock') return;

        try {
            setAdding(true);
            await addToCart(product.id, 1); // Ajoute/incrémente via /ballou/v1/cart/update (Woo compatible)
            emitCartUpdated(); // Notifie CartBadge (compteur +1)
            setAdded(true); // Switch vers "Voir"
        } catch (err) {
            console.error('Erreur ajout panier:', err);
            alert("Impossible d'ajouter ce produit au panier.");
        } finally {
            setAdding(false);
        }
    }

    if (loading) {
        return <div className="p-4 text-center loading">Chargement du produit...</div>; // Hérite dark via CSS
    }

    if (!product) {
        return (
            <div className="p-4 text-center error">Produit non trouvé.</div> // Primary via CSS
        );
    }

    // Extraire conditionals en consts (flat JS, no JSX nesting)
    const dimensionsElement = product.dimensions ? (
        <p className="text-muted">Dimension : {product.dimensions}</p> // Muted via utility (no interpol issue)
    ) : null;

    // Bouton : Comme ProductCard (petit pilule border orange, loading, switch "Voir" après ajout)
    let addToCartButton;
    if (product.stock_status !== 'instock') {
        addToCartButton = <p className="text-primary font-medium">Stock épuisé</p>; // Primary via utility
    } else if (added) {
        // Après ajout : Lien "Voir" (fond orange, blanc, comme ProductCard)
        addToCartButton = (
            <a
                href={getCartUrl()}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:opacity-95"
                style={{
                    borderColor: "var(--brand-accent, #e94e1b)",
                    background: "var(--brand-accent, #e94e1b)",
                    color: "var(--brand-light, #ffffff)",
                }}
                title="Voir le panier"
                aria-label="Voir le panier"
                onClick={(e) => e.stopPropagation()}
            >
                Voir
            </a>
        );
    } else {
        // Bouton "Ajouter" (border/text orange, active scale, disabled loading)
        addToCartButton = (
            <button
                type="button"
                onClick={handleAdd}
                disabled={adding}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold active:scale-95 disabled:opacity-60"
                style={{
                    borderColor: "var(--brand-accent, #e94e1b)", // Orange accent pour bordure/texte
                    color: "var(--brand-accent, #e94e1b)",
                }}
                title="Ajouter au panier"
                aria-label="Ajouter au panier"
            >
                {adding ? "Ajout..." : "Ajouter"}
            </button>
        );
    }

    const descriptionElement = product.description ? (
        <div className="prose max-w-none"> {/* Hérite dark via CSS + typography plugin */}
            <div dangerouslySetInnerHTML={{ __html: product.description }} />
        </div>
    ) : null;

    // NOUVEAU : Conteneur flex pour SKU (gauche) + bouton/message (droite)
    const skuAndButton = (
        <div className="flex justify-between items-center mb-4">
            {product.sku ? (
                <p className="text-sm text-muted">Ref: {product.sku}</p>
            ) : null}
            <div className="text-right">
                {addToCartButton}
            </div>
        </div>
    );

    return (
        <div className="product-summary space-y-4 mt-4 mb-6"> {/* Hérite charte via CSS base – espacement vertical auto */}
            <h1 className="text-2xl font-bold">{product.title}</h1> {/* Dark via CSS */}
            <div className="text-primary text-xl font-semibold" dangerouslySetInnerHTML={{ __html: product.price }} /> {/* UN SEUL PRIX : Grand, bleu primary, Woo HTML */}
            {skuAndButton}  {/* NOUVEAU : Remplace {addToCartButton} direct */}
            {dimensionsElement} {/* Injection flat, no nesting */}
            <hr className="border-gray-300 my-6" /> {/* Standard gris clair (≈ primary/20) */}
            {descriptionElement} {/* Description bas, flat */}
        </div>
    );
};

export default SingleProduct;