import { getSiteLogo } from "./logo";
import { getProductCategoriesForMenu } from "./categoryMenu";


// ⬅️ corrige: exporter depuis la LIB, pas depuis un composant React
export { fetchBestSellersLite } from "./bestseller";

export type BallouCategory = {
    id: number;
    name: string;
    slug: string;
    count: number;
    parent: number;
    children?: BallouCategory[];
};

export async function getSiteLogoFromApi() {
    try {
        const logoUrl = await getSiteLogo();
        console.log("Logo URL:", logoUrl);
        return logoUrl;
    } catch (error) {
        console.error("Error fetching logo:", error);
        return "/path/to/default/logo.png";
    }
}

export async function getCategoriesForMenu() {
    try {
        const categories = await getProductCategoriesForMenu();
        console.log("Product Categories:", categories);
        return categories;
    } catch (error) {
        console.error("Error fetching categories:", error);
        return [];
    }
}