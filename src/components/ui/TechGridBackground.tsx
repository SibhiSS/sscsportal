import { useMemo } from 'react';

// CSS keyframe animations run on the compositor thread — zero JS overhead.
// These styles inject a tiny <style> tag once on mount.
const cssAnimations = `
@keyframes blobDrift1 {
  0%   { transform: translate(0px, 0px) scale(1); }
  33%  { transform: translate(50px, 20px) scale(1.2); }
  66%  { transform: translate(20px, -30px) scale(0.95); }
  100% { transform: translate(0px, 0px) scale(1); }
}
@keyframes blobDrift2 {
  0%   { transform: translate(0px, 0px) scale(1); }
  33%  { transform: translate(-60px, 40px) scale(1.1); }
  66%  { transform: translate(-20px, 80px) scale(0.98); }
  100% { transform: translate(0px, 0px) scale(1); }
}
@keyframes particleDrift1 {
  0%   { transform: translate(0, 0) scale(0.8); opacity: 0; }
  20%  { opacity: 0.5; }
  50%  { transform: translate(50px, -50px) scale(1.1); opacity: 0.5; }
  80%  { opacity: 0.5; }
  100% { transform: translate(0, 0) scale(0.8); opacity: 0; }
}
@keyframes particleDrift2 {
  0%   { transform: translate(0, 0) scale(0.9); opacity: 0; }
  20%  { opacity: 0.4; }
  50%  { transform: translate(-50px, 50px) scale(1.05); opacity: 0.4; }
  80%  { opacity: 0.4; }
  100% { transform: translate(0, 0) scale(0.9); opacity: 0; }
}
@keyframes particleDrift3 {
  0%   { transform: translate(0, 0) scale(0.85); opacity: 0; }
  20%  { opacity: 0.35; }
  50%  { transform: translate(30px, 60px) scale(1.15); opacity: 0.35; }
  80%  { opacity: 0.35; }
  100% { transform: translate(0, 0) scale(0.85); opacity: 0; }
}
@keyframes particleDrift4 {
  0%   { transform: translate(0, 0) scale(1); opacity: 0; }
  20%  { opacity: 0.45; }
  50%  { transform: translate(-40px, -60px) scale(1.1); opacity: 0.45; }
  80%  { opacity: 0.45; }
  100% { transform: translate(0, 0) scale(1); opacity: 0; }
}
@keyframes particleDrift5 {
  0%   { transform: translate(0, 0) scale(0.8); opacity: 0; }
  20%  { opacity: 0.3; }
  50%  { transform: translate(60px, 30px) scale(1.2); opacity: 0.3; }
  80%  { opacity: 0.3; }
  100% { transform: translate(0, 0) scale(0.8); opacity: 0; }
}
@keyframes particleDrift6 {
  0%   { transform: translate(0, 0) scale(0.9); opacity: 0; }
  20%  { opacity: 0.4; }
  50%  { transform: translate(-30px, 50px) scale(1.1); opacity: 0.4; }
  80%  { opacity: 0.4; }
  100% { transform: translate(0, 0) scale(0.9); opacity: 0; }
}
`;

// 6 particles — same visual density as before, much lighter
const PARTICLES = [
  { left: '8%',  top: '12%', size: 160, anim: 'particleDrift1', dur: '18s', delay: '0s'   },
  { left: '75%', top: '20%', size: 130, anim: 'particleDrift2', dur: '22s', delay: '-6s'  },
  { left: '35%', top: '60%', size: 180, anim: 'particleDrift3', dur: '20s', delay: '-10s' },
  { left: '55%', top: '80%', size: 120, anim: 'particleDrift4', dur: '25s', delay: '-4s'  },
  { left: '20%', top: '45%', size: 140, anim: 'particleDrift5', dur: '15s', delay: '-8s'  },
  { left: '85%', top: '65%', size: 110, anim: 'particleDrift6', dur: '19s', delay: '-2s'  },
];

// Static pulsing dots — CSS animation, no JS
const DOTS = [
  { top: '15%', left: '20%', dur: '3s', delay: '0s'   },
  { top: '45%', left: '80%', dur: '4s', delay: '1s'   },
  { top: '75%', left: '30%', dur: '5s', delay: '2s'   },
  { top: '25%', left: '70%', dur: '6s', delay: '0.5s' },
];

const TechGridBackground = () => {
    // Inject CSS animations once
    const styleTag = useMemo(() => (
        <style>{cssAnimations}</style>
    ), []);

    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#020202]">
            {styleTag}

            {/* 1. Animated Blobs — CSS animation (compositor thread) */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-primary/10 rounded-full blur-[180px]"
                    style={{
                        animation: 'blobDrift1 25s ease-in-out infinite',
                        willChange: 'transform',
                    }}
                />
                <div
                    className="absolute bottom-[-20%] right-[-10%] w-[55vw] h-[55vw] bg-primary/[0.08] rounded-full blur-[160px]"
                    style={{
                        animation: 'blobDrift2 22s ease-in-out infinite',
                        willChange: 'transform',
                    }}
                />
            </div>

            {/* 2. Red Tech Grid Pattern */}
            <div
                className="absolute inset-0 opacity-[0.15]"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, rgba(220, 20, 60, 0.1) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(220, 20, 60, 0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px',
                    maskImage: 'radial-gradient(circle at 50% 50%, black, transparent 90%)'
                }}
            />

            {/* 3. Lightweight CSS particles (replaces 15 Framer Motion ones) */}
            <div className="absolute inset-0">
                {/* Static pulsing dots */}
                {DOTS.map((dot, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-primary/40 rounded-full animate-pulse"
                        style={{
                            top: dot.top,
                            left: dot.left,
                            animationDuration: dot.dur,
                            animationDelay: dot.delay,
                        }}
                    />
                ))}

                {/* CSS-animated particles */}
                {PARTICLES.map((p, i) => (
                    <div
                        key={`p-${i}`}
                        className="absolute bg-primary/20 rounded-full blur-[60px] pointer-events-none"
                        style={{
                            left: p.left,
                            top: p.top,
                            width: p.size,
                            height: p.size,
                            animation: `${p.anim} ${p.dur} ease-in-out infinite`,
                            animationDelay: p.delay,
                            willChange: 'transform, opacity',
                        }}
                    />
                ))}
            </div>

            {/* 4. Noise Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            />

            {/* 5. Vignette */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(circle at center, transparent 0%, rgba(5, 5, 5, 0.4) 100%)'
                }}
            />
        </div>
    );
};

export default TechGridBackground;
