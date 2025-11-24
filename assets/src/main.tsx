import React from "react";
import { createRoot } from "react-dom/client";
import Header from "./islands/Header";
import Hero from "./Components/Homepages/Hero";
import SearchBox from "./islands/SearchBox";
import MiniCart from "./islands/MiniCart";
import Bestsellers from "./Components/Homepages/BestSellers";
import OursSelect from "./Components/Homepages/OursSelect";
import BestCategory from "./Components/Homepages/BestCategory";
import ProductsClient from "./Components/Produits/ProductsClient";
import CartClient from "./islands/CartClient";
import CheckoutIsland from "./islands/checkout"; // Assurez chemin exact (sans .tsx)
import Thankyou from "./islands/thankyou"; // Nouveau : Import pour merci page
import "../index.css";
import ContactIsland from "./islands/ContactIsland";
import Footer from "./islands/Footer";
import SingleProduct from "./islands/singleproduct";
import Gallery from "./islands/gallery";
import MyAccount from "./islands/MyAccount";
import LoginIsland from "./islands/login";
import { register } from "./lib/register";
import RegisterIsland from "./islands/Register";
import CGV from "./islands/cgv";
import Cookies from "./islands/cookies";
import About from "./islands/about";
import SimilarProduct from "./Components/Singleproduct/similarproduct";

const registry: Record<string, React.FC<any>> = {
    header: Header,
    hero: Hero,
    searchbox: SearchBox,
    minicart: MiniCart,
    bestsellers: Bestsellers,
    oursselect: OursSelect,
    bestcategory: BestCategory,
    produits: ProductsClient,
    produit: ProductsClient,
    cart: CartClient,
    checkout: CheckoutIsland,
    thankyou: Thankyou,
    singleproduct: SingleProduct,
    gallery: Gallery,
    myaccount: MyAccount,
    contact: ContactIsland,
    login: LoginIsland,
    cgv: CGV,
    cookies: Cookies,
    register: RegisterIsland,
    about: About,
    similarproduct: SimilarProduct,
    footer: Footer
};

let islandsMounted = false; // Flag global pour éviter double mount (évite logs/re-renders dupliqués)

function mountIslands() {
    if (islandsMounted) {
        console.log("[Main] Islands déjà montées, skip.");
        return;
    }
    console.log("[Main] Scan islands...");
    const islands = document.querySelectorAll<HTMLElement>("[data-island]");
    console.log(`[Main] Found ${islands.length} islands`); // Ex: 1 pour checkout, 1 pour thankyou

    islands.forEach((node) => {
        const name = (node.dataset.island || "").toLowerCase();
        console.log(`[Main] Mounting island: ${name}`);
        const Comp = registry[name];
        if (!Comp) {
            console.warn(`[Main] Island "${name}" non trouvée dans registry. Available:`, Object.keys(registry));
            return;
        }
        let props: any = {};
        try {
            props = node.dataset.props ? JSON.parse(node.dataset.props) : {};
            console.log(`[Main] Props for ${name}:`, props); // Debug props (ex: pour thankyou: {orderId:1184, orderKey:"wc_...", apiBase:"..."})
        } catch (e) {
            console.error(`[Main] Props parse error pour ${name}:`, e);
        }
        try {
            // Efface fallback seulement si succès (évite mismatch hydration)
            node.innerHTML = "";
            createRoot(node).render(React.createElement(Comp, { ...props, key: name }));
            console.log(`[Main] Island "${name}" montée avec succès.`);
        } catch (e) {
            console.error(`[Main] Render error pour ${name}:`, e);
            // Restore fallback partiel si fail (ex. header du fallback + erreur visible)
            node.innerHTML = `<h1 class="text-2xl font-bold mb-4">${name.charAt(0).toUpperCase() + name.slice(1)}</h1><div class="text-red-600 p-4 bg-red-50 rounded">Erreur montage: ${e.message}</div>`;
        }
    });
    islandsMounted = true; // Marque comme fait
}

// Mount on DOM ready (ou immédiat si déjà loaded)
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        console.log("[Main] DOM ready, mounting...");
        mountIslands();
    });
} else {
    mountIslands();
}

// Optionnel : Cleanup pour hot-reload dev (si Vite/HMR)
if (process.env.NODE_ENV === "development") {
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.onCommitFiberRoot?.(null, null); // Reset si needed
}