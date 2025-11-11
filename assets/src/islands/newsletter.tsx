import * as React from 'react'


export default function Newsletter({ placeholder = 'Votre e‑mail', button = "S'abonner" }) {
    const [email, setEmail] = React.useState('')
    const [status, setStatus] = React.useState<'idle' | 'ok' | 'err'>('idle')
    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        // TODO: brancher sur un endpoint (Mailchimp/MailerLite ou admin-ajax)
        try { setStatus('ok'); } catch { setStatus('err'); }
    }
    return (
        <form onSubmit={onSubmit} className="flex gap-2">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={placeholder} className="input" />
            <button className="btn btn-primary" type="submit">{button}</button>
            {status === 'ok' && <span className="text-green-600">Merci !</span>}
            {status === 'err' && <span className="text-red-600">Erreur, réessayez.</span>}
        </form>
    )
}