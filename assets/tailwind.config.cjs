// tailwind.config.cjs
module.exports = {
    content: ["./**/*.php", "./src/**/*.{ts,tsx}"],
    theme: { extend: {} },
    plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
