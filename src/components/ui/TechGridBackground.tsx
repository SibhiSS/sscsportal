
const TechGridBackground = () => {
    return (
        <div className="absolute inset-0 -z-10 overflow-hidden bg-background">
            {/* Static Grid Pattern using CSS gradients */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `
            linear-gradient(to right, rgba(234, 179, 8, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(234, 179, 8, 0.05) 1px, transparent 1px)
          `,
                    backgroundSize: '40px 40px',
                    maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
                }}
            />

            {/* Subtle random glowing dots (CSS Animation only) */}
            <div className="absolute inset-0">
                <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-primary/40 rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
                <div className="absolute top-3/4 left-2/3 w-1 h-1 bg-primary/40 rounded-full animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
                <div className="absolute top-1/3 left-3/4 w-1 h-1 bg-primary/40 rounded-full animate-pulse" style={{ animationDuration: '5s', animationDelay: '0.5s' }} />
                <div className="absolute top-2/3 left-1/5 w-1 h-1 bg-primary/40 rounded-full animate-pulse" style={{ animationDuration: '3.5s', animationDelay: '2s' }} />
            </div>

            {/* Vignette */}
            <div className="absolute inset-0 bg-background/30"
                style={{ background: 'radial-gradient(circle at center, transparent 0%, rgba(10, 10, 15, 0.8) 100%)' }}
            />
        </div>
    );
};

export default TechGridBackground;
