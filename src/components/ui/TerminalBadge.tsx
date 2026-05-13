
const TerminalBadge = ({ children, status = "active" }: { children: React.ReactNode, status?: "active" | "warning" | "idle" }) => {
    const colorClass =
        status === "active" ? "text-primary border-primary/30 bg-primary/5" :
            status === "warning" ? "text-orange-400 border-orange-400/30 bg-orange-400/5" :
                "text-muted-foreground border-white/10 bg-white/5";

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-mono rounded border ${colorClass}`}>
            <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'active' ? 'bg-primary' : status === 'warning' ? 'bg-orange-400' : 'bg-gray-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'active' ? 'bg-primary' : status === 'warning' ? 'bg-orange-400' : 'bg-gray-400'}`}></span>
            </span>
            <span>[ {children} ]</span>
        </div>
    );
};

export default TerminalBadge;
