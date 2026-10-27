import { useEffect, useRef, useState } from 'react';

const InteractiveGridBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = window.innerWidth;
        let height = window.innerHeight;

        const gridSize = 40;
        const mouse = { x: -1000, y: -1000 };
        const range = 200; // Increased range for better interaction

        // Circuit board "pulses"
        const pulses: { x: number, y: number, isVert: boolean, speed: number, life: number, maxLife: number }[] = [];

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', resize);
        resize();

        const onMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        };

        window.addEventListener('mousemove', onMouseMove);

        const render = () => {
            ctx.clearRect(0, 0, width, height);

            // 1. Draw Grid Lines
            ctx.lineWidth = 1;

            // Helper to draw lines
            const drawGridLine = (x1: number, y1: number, x2: number, y2: number, val: number, isVert: boolean) => {
                const dist = isVert ? Math.abs(x1 - mouse.x) : Math.abs(y1 - mouse.y);
                const mouseNear = Math.max(0, 1 - dist / range);

                // Base faint line + mouse glow
                let alpha = 0.03 + (mouseNear * 0.4);

                ctx.beginPath();
                ctx.strokeStyle = `rgba(234, 179, 8, ${alpha})`;
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                // 2. Draw Nodes (Dots at intersections)
                // Only draw nodes if mouse is somewhat near or randomly
                if (mouseNear > 0.1) {
                    const nodeRange = 100;
                    // Calculate intersection point (simple since we loop x/y)
                    // We need loops to cross. Let's do nodes separately to manage complexity or just inline here?
                    // Inline is tricky with separate loops. Let's do a separate node pass or clever math.
                    // Actually, let's keep lines simple.
                }
            };

            // Vertical lines
            for (let x = 0; x <= width; x += gridSize) {
                drawGridLine(x, 0, x, height, x, true);
            }
            // Horizontal lines
            for (let y = 0; y <= height; y += gridSize) {
                drawGridLine(0, y, width, y, y, false);
            }

            // 3. Draw Intersections / Nodes
            // We optimized this to only draw nodes near the mouse or random "active" nodes
            for (let x = 0; x <= width; x += gridSize) {
                for (let y = 0; y <= height; y += gridSize) {
                    const dx = x - mouse.x;
                    const dy = y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < range) { // Only draw nodes within influence range
                        const alpha = (1 - dist / range) * 0.8;
                        ctx.fillStyle = `rgba(234, 179, 8, ${alpha})`;
                        ctx.beginPath();
                        ctx.arc(x, y, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // 4. Circuit Pulses (Data travelling)
            if (Math.random() > 0.95 && pulses.length < 15) { // Spawn new pulse
                // Pick a random line (vert or horiz) and starting pos
                const isVert = Math.random() > 0.5;
                const snapX = Math.floor(Math.random() * (width / gridSize)) * gridSize;
                const snapY = Math.floor(Math.random() * (height / gridSize)) * gridSize;

                pulses.push({
                    x: snapX,
                    y: snapY,
                    isVert,
                    speed: 2 + Math.random() * 2,
                    life: 0,
                    maxLife: 50 + Math.random() * 50
                });
            }

            // Update & Draw Pulses
            for (let i = pulses.length - 1; i >= 0; i--) {
                const p = pulses[i];
                p.life++;

                if (p.isVert) {
                    p.y += p.speed;
                } else {
                    p.x += p.speed;
                }

                // Fade out
                const lifePct = 1 - (p.life / p.maxLife);
                if (lifePct <= 0 || p.x > width || p.y > height) {
                    pulses.splice(i, 1);
                    continue;
                }

                ctx.fillStyle = `rgba(234, 179, 8, ${lifePct})`;
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'rgba(234, 179, 8, 1)';
                ctx.beginPath();
                // Draw a little "head" for the pulse
                ctx.rect(p.x - 1, p.y - 1, 3, 3);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []); // Empty dependency array, we use local vars

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 -z-10 w-full h-full pointer-events-none"
        />
    );
};

export default InteractiveGridBackground;
