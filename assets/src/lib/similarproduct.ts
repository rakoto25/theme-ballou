export interface SimilarProductData {
    id: number;
    slug: string;
    title: string;
    price: string; // HTML from get_price_html()
    imageUrl: string;
    stock_status: string;
    sku: string;
    permalink: string;
}

export interface SimilarProductsProps {
    products: SimilarProductData[];
}

export function fetchSimilarProducts(slug: string): Promise<SimilarProductData[]> {
    // Optional: If you ever need client-side fetch (e.g., no props), use Woo REST /products?slug={slug}&related=true
    // But since PHP passes props, this can stay stubbed or unused.
    return fetch(`/wp-json/wc/v3/products?slug=${encodeURIComponent(slug)}&per_page=6`)
        .then(res => res.json())
        .then(products => products as SimilarProductData[]);
}