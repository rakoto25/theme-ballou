import { hydrateRoot } from 'react-dom/client'
import './styles/tailwind.css'
const islands = {
    filters: () => import('./islands/filters'),
    minicart: () => import('./islands/minicart'),
    searchbox: () => import('./islands/searchbox'),
    gallery: () => import('./islands/gallery'),
} as const


type IslandName = keyof typeof islands


function bootIslands() {
    const nodes = document.querySelectorAll<HTMLElement>('[data-island]')
    nodes.forEach(async (el) => {
        const name = el.dataset.island as IslandName
        if (!name || !islands[name]) return
        const mod = await islands[name]()
        const Comp = (mod as any).default
        const props = el.dataset.props ? JSON.parse(el.dataset.props) : {}
        hydrateRoot(el, Comp ? Comp(props) : null)
    })
}


document.addEventListener('DOMContentLoaded', bootIslands)