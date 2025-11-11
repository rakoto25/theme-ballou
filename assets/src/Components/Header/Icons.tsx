// src/Components/Icons.tsx ou src/Components/Icons.ts

import React from "react";

export const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.8-4.8m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z" />
    </svg>
);

export const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <path strokeWidth="1.8" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

export const CartIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2 12h10l2-8H7M9 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
);

export const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <path strokeWidth="1.8" strokeLinecap="round" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm7 8a7 7 0 0 0-14 0" />
    </svg>
);