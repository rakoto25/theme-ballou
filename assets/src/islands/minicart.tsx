import * as React from 'react'
export default function MiniCart() {
    const [open, setOpen] = React.useState(false)
    return (
        <div className="mini-cart">
            <button onClick={() => setOpen(v => !v)}>Panier</button>
            {open && <div className="mini-cart-panel">(Items…)</div>}
        </div>
    )
}