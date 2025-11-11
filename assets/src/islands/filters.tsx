import * as React from 'react'


export default function Filters() {
    const [loading, setLoading] = React.useState(false)
    async function apply(params: Record<string, string>) {
        const url = new URL((window as any).__BALLOU__.ajaxUrl)
        url.searchParams.set('action', 'ballou_filter_products')
        url.searchParams.set('nonce', (window as any).__BALLOU__.nonce)
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
        setLoading(true)
        const res = await fetch(url.toString(), { credentials: 'same-origin' })
        const json = await res.json()
        setLoading(false)
        if (json?.success && json.data?.html) {
            const target = document.getElementById('ballou-listing')
            if (target) target.innerHTML = json.data.html
            // Mettre à jour l’URL visible (pushState) si utile
            const qs = new URLSearchParams(params).toString()
            history.pushState({}, '', qs ? `?${qs}` : location.pathname)
        }
    }
    return (
        <div className="ballou-filters">
            <button disabled={loading} onClick={() => apply({ cat: 'smartphones' })}>Smartphones</button>
            <button disabled={loading} onClick={() => apply({ brand: 'samsung' })}>Samsung</button>
        </div>
    )
}