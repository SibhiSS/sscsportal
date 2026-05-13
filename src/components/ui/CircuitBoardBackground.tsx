
import { useEffect, useRef } from 'react';

const CircuitBoardBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        let animationFrameId: number;

        // Configuration
        const gridSize = 30; // Closer grid for more dense circuit look
        const nodeProbability = 0.15; // Chance of a node at intersection
        const pulseCount = 10;
        const color = "234, 179, 8"; // Yellow RGB

        // State
        const mouse = { x: -100, y: -100 };
        const nodes: { x: number, y: number }[] = [];
        const pulses: { x: number, y: number, dx: number, dy: number, life: number, path: { x: number, y: number }[] }[] = [];

        // Initialize Nodes (Static "Chips")
        const initNodes = () => {
            nodes.length = 0;
            const cols = Math.ceil(width / gridSize);
            const rows = Math.ceil(height / gridSize);

            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    if (Math.random() < nodeProbability) {
                        nodes.push({
                            x: i * gridSize,
                            y: j * gridSize
                        });
                    }
                }
            }
        };

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initNodes();
        };

        window.addEventListener('resize', resize);
        initNodes();

        const onMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        };
        window.addEventListener('mousemove', onMouseMove);

        // Animation Loop
        const render = () => {
            ctx.clearRect(0, 0, width, height);

            // 1. Draw Static Grid (Faint)
            ctx.strokeStyle = `rgba(${color}, 0.05)`;
            ctx.lineWidth = 1;
            ctx.beginPath();

            // Draw only grid lines that connect to nodes for a cleaner "circuit" look? 
            // Or full grid? Let's do full grid but very faint.
            for (let x = 0; x <= width; x += gridSize) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            for (let y = 0; y <= height; y += gridSize) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();

            // 2. Draw Nodes & Connections near Mouse
            nodes.forEach(node => {
                const dist = Math.hypot(node.x - mouse.x, node.y - mouse.y);
                const limit = 200;

                if (dist < limit) {
                    const alpha = 1 - dist / limit;

                    // Draw Node
                    ctx.fillStyle = `rgba(${color}, ${alpha * 0.8})`;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
                    ctx.fill();

                    // Connect to mouse for "active" feel? 
                    // Or just light up grid lines?
                    // Let's light up the node strongly
                    ctx.shadowColor = `rgba(${color}, 1)`;
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = `rgba(${color}, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });

            // 3. Draw Pulses (Data Flow)
            // Spawn new pulses
            if (pulses.length < pulseCount && Math.random() < 0.02) {
                // Start from a random node
                if (nodes.length > 0) {
                    const startNode = nodes[Math.floor(Math.random() * nodes.length)];
                    pulses.push({
                        x: startNode.x,
                        y: startNode.y,
                        dx: Math.random() > 0.5 ? (Math.random() > 0.5 ? 2 : -2) : 0,
                        dy: 0, // Will set velocity logic below
                        life: 100,
                        path: []
                    });
                    // Fix velocity initial
                    const p = pulses[pulses.length - 1];
                    if (Math.random() > 0.5) {
                        p.dx = Math.random() > 0.5 ? 2 : -2;
                        p.dy = 0;
                    } else {
                        p.dx = 0;
                        p.dy = Math.random() > 0.5 ? 2 : -2;
                    }
                }
            }

            // Update & Draw Pulses
            for (let i = pulses.length - 1; i >= 0; i--) {
                const p = pulses[i];
                p.x += p.dx;
                p.y += p.dy;
                p.life--;

                // Change direction randomly at grid intersections
                if (p.life % 15 === 0 && Math.random() > 0.5) {
                    if (p.dx !== 0) {
                        p.dx = 0;
                        p.dy = Math.random() > 0.5 ? 2 : -2;
                    } else {
                        p.dy = 0;
                        p.dx = Math.random() > 0.5 ? 2 : -2;
                    }
                }

                // Draw Head
                ctx.fillStyle = `rgba(${color}, 1)`;
                ctx.shadowColor = `rgba(${color}, 0.8)`;
                ctx.shadowBlur = 5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Draw Trail
                // Simplified trail: just a tail opacity fade? 
                // Let's just draw the head moving to look like a packet.

                if (p.life <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
                    pulses.splice(i, 1);
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };
        render();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0 }} // Ensure it's behind content but visible
        />
    );
};

export default CircuitBoardBackground;
