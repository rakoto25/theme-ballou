import React from "react";

interface ContentSection {
    title: string;
    text: string;
    features?: string[];
}

interface Props {
    title: string;
    siteName: string;
    siteUrl: string;
    contactEmail: string;
    phone: string;
    showroomAddress: string;
    showroomSize: string;
    mapImage: string;
    partnersImage: string;
    aboutImage: string;
    content: {
        intro: string;
        history: ContentSection;
        philosophy: ContentSection;
        products: ContentSection & { features: string[] };
        coverage: ContentSection;
        showroom: ContentSection;
    };
    customContent?: string;
}

const About: React.FC<Props> = ({
    title,
    content,
    mapImage,
    aboutImage,
    partnersImage,
    showroomAddress,
    showroomSize,
    contactEmail,
    phone,
    customContent,
}) => {
    return (
        <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            {/* HERO */}
            <section className="relative overflow-hidden rounded-3xl bg-[#29235c] text-white mb-16 shadow-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-[rgba(0,0,0,0.55)] via-[rgba(0,0,0,0.3)] to-transparent" />
                <div
                    className="absolute inset-y-0 right-0 w-full md:w-1/2 opacity-60 md:opacity-100"
                    style={{
                        backgroundImage: `url(${aboutImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
                <div className="relative z-10 grid md:grid-cols-2 gap-10 lg:gap-16 px-6 sm:px-10 lg:px-16 py-14 lg:py-20">
                    <div className="space-y-6 md:space-y-8 z-10">
                        <p className="text-sm uppercase tracking-[0.25em] text-[#e94e1b]">
                            Spécialiste d&apos;intérieur depuis 1963
                        </p>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                            {title}
                        </h1>
                        <p className="text-base sm:text-lg text-white/90 max-w-xl">
                            {content.intro}
                        </p>

                        <div className="flex flex-wrap gap-4 pt-4">
                            <a
                                href="/contact"
                                className="px-6 py-3 bg-white text-[#29235c] font-semibold rounded-full hover:bg-gray-100 transition-all shadow-lg"
                            >
                                Nous contacter
                            </a>
                            <a
                                href={`tel:${phone}`}
                                className="px-6 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-[#29235c] transition-all"
                            >
                                Appeler maintenant
                            </a>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center justify-end">
                        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 lg:p-8 w-full max-w-sm border border-white/20">
                            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#e94e1b] mb-4">
                                En un coup d&apos;œil
                            </p>
                            <dl className="space-y-4 text-sm">
                                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                                    <dt className="text-white/80">Années d&apos;expertise</dt>
                                    <dd className="font-semibold">60+</dd>
                                </div>
                                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                                    <dt className="text-white/80">Origine des produits</dt>
                                    <dd className="font-semibold">Europe</dd>
                                </div>
                                <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                                    <dt className="text-white/80">Showroom</dt>
                                    <dd className="font-semibold">{showroomSize}</dd>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <dt className="text-white/80">Adresse</dt>
                                    <dd className="text-right text-sm">
                                        {showroomAddress}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            </section>

            {/* HISTOIRE */}
            <section className="mb-16 lg:mb-20">
                <div className="flex items-center mb-8">
                    <div className="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                    <h2 className="text-2xl sm:text-3xl font-bold ml-4 text-[#29235c]">
                        {content.history.title}
                    </h2>
                </div>
                <div className="grid lg:grid-cols-2 gap-8 items-center">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p className="text-base sm:text-lg text-[#1b1919] leading-relaxed">
                            {content.history.text}
                        </p>
                    </div>
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-[#29235c] flex items-center justify-center text-white font-bold">1963</div>
                            <h3 className="text-xl font-semibold text-[#29235c]">Début de l'aventure</h3>
                        </div>
                        <p className="text-sm text-[#1b1919]/80">
                            Un modeste magasin de tissus de 12 m² à Analakely, Antananarivo
                        </p>
                    </div>
                </div>
            </section>

            {/* PHILOSOPHIE */}
            <section className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-3xl border border-gray-100 shadow-sm mb-16 lg:mb-20">
                <div className="flex items-center mb-6">
                    <div className="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                    <h2 className="text-2xl sm:text-3xl font-bold ml-4 text-[#29235c]">
                        {content.philosophy.title}
                    </h2>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-base sm:text-lg text-[#1b1919] leading-relaxed">
                        {content.philosophy.text}
                    </p>
                </div>
            </section>

            {/* PRODUITS */}
            <section className="mb-16 lg:mb-20">
                <div className="flex items-center mb-8">
                    <div className="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                    <h2 className="text-2xl sm:text-3xl font-bold ml-4 text-[#29235c]">
                        {content.products.title}
                    </h2>
                </div>
                <p className="text-base sm:text-lg text-[#1b1919] leading-relaxed mb-6">
                    {content.products.text}
                </p>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {content.products.features.map((feature, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-5 shadow-sm hover:shadow-md transition-all"
                        >
                            <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e94e1b]/10 text-[#e94e1b]">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                </svg>
                            </span>
                            <p className="text-sm text-[#1b1919] leading-relaxed">
                                {feature}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* COUVERTURE */}
            <section className="grid lg:grid-cols-2 gap-10 items-center mb-16 lg:mb-20">
                <div>
                    <div className="flex items-center mb-6">
                        <div className="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                        <h2 className="text-2xl sm:text-3xl font-bold ml-4 text-[#29235c]">
                            {content.coverage.title}
                        </h2>
                    </div>
                    <p className="text-base sm:text-lg text-[#1b1919] leading-relaxed">
                        {content.coverage.text}
                    </p>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="text-3xl font-bold text-[#29235c]">60+</div>
                            <div className="text-sm text-[#1b1919]/80">Années d'expérience</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="text-3xl font-bold text-[#29235c]">Europe</div>
                            <div className="text-sm text-[#1b1919]/80">Origine des produits</div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <img
                        src={mapImage}
                        alt="Carte de Madagascar avec les points Ballou"
                        className="w-full h-80 object-contain rounded-2xl shadow-lg border-4 border-white"  // Changed to object-contain and h-80 for larger full view
                        loading="lazy"
                    />
                    <p className="text-xs text-[#1b1919]/80 text-center">
                        Ballou accompagne particuliers et professionnels dans la majorité des grandes villes de Madagascar.
                    </p>
                </div>

            </section>

            {/* SHOWROOM */}
            <section className="rounded-3xl bg-[#29235c] p-8 text-white shadow-xl mb-16 lg:mb-20">
                <div className="flex items-center mb-6">
                    <div className="h-1 w-16 bg-[#e94e1b] rounded-full"></div>
                    <h2 className="text-2xl sm:text-3xl font-bold ml-4">
                        {content.showroom.title}
                    </h2>
                </div>
                <div className="grid lg:grid-cols-2 gap-8 items-center">
                    <div>
                        <p className="text-base sm:text-lg text-white/90 leading-relaxed mb-4">
                            {content.showroom.text}
                        </p>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-semibold">Adresse : </span>
                                {showroomAddress}
                            </div>
                            <div>
                                <span className="font-semibold">Surface : </span>
                                {showroomSize}
                            </div>
                        </div>
                        <div className="mt-6 flex flex-wrap gap-3">
                            <a href="/contact" className="px-6 py-3 bg-white text-[#29235c] font-semibold rounded-full hover:bg-gray-100 transition-all">
                                Prendre rendez-vous
                            </a>
                            <a href="#" className="px-6 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-[#29235c] transition-all">
                                Découvrir nos univers
                            </a>
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                        <img
                            src={partnersImage}
                            alt="Marques et partenaires Ballou"
                            className="w-full rounded-xl object-cover"
                            loading="lazy"
                        />
                    </div>
                </div>
            </section>

            {/* CONTENU CUSTOM ACF */}
            {customContent && (
                <section className="mb-16 lg:mb-20">
                    <div className="rounded-3xl bg-gray-50 border border-gray-100 px-6 sm:px-8 py-8 sm:py-10 prose prose-sm sm:prose-base max-w-none prose-headings:text-[#29235c] prose-a:text-[#e94e1b]">
                        <div dangerouslySetInnerHTML={{ __html: customContent }} />
                    </div>
                </section>
            )}

            {/* FOOTER LOCAL DE LA PAGE */}
            <footer className="border-t border-gray-200 pt-8 mt-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
                    <p className="text-[#1b1919]/80 text-center md:text-left">
                        Transformez vos espaces avec Ballou – du premier croquis au dernier
                        coussin.
                    </p>
                    <p className="text-center md:text-right text-sm">
                        <a
                            href={`tel:${phone}`}
                            className="font-semibold text-[#29235c] hover:underline"
                        >
                            {phone}
                        </a>{" "}
                        ·{" "}
                        <a
                            href={`mailto:${contactEmail}`}
                            className="font-semibold text-[#e94e1b] hover:underline"
                        >
                            {contactEmail}
                        </a>
                    </p>
                </div>
            </footer>
        </article>
    );
};

export default About;