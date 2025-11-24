export interface ProductData {
    id: number;
    slug: string;
    title: string;
    price: string;
    description: string;
    dimensions?: string;
    images: number[];
    add_to_cart_url?: string;
    stock_status?: string;
    sku?: string;  // NOUVEAU : Ajout du SKU
    meta?: Record<string, any>;
}

export const fetchProduct = async (slug: string): Promise<ProductData | null> => {
    const response = await fetch(`/wp-json/wc/v3/products?slug=${slug}`, {
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('Erreur fetch produit');
    const products = await response.json();
    const prod = products[0];
    if (!prod) return null;

    // Mappe attributs API vers dimensions (adaptez 'pa_dimension' à votre setup Woo)
    let dimensions = '';
    if (prod.attributes) {
        const dimAttr = prod.attributes.find((attr: any) => attr.name === 'Dimension' || attr.slug === 'pa_dimension');
        if (dimAttr && dimAttr.options && dimAttr.options.length > 0) {
            dimensions = dimAttr.options[0]; // Premier option
        }
    }

    return {
        id: prod.id,
        slug: prod.slug,
        title: prod.name,
        price: prod.price_html || '',
        description: prod.description || '',
        dimensions,
        images: prod.images?.map((img: any) => img.id) || [],
        add_to_cart_url: prod.add_to_cart?.url || `/product/${prod.slug}/?add-to-cart=${prod.id}`,
        stock_status: prod.stock_status || 'instock',
        sku: prod.sku || '',
        meta: prod.meta_data || {},
    };
};