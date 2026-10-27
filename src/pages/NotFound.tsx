import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import TechGridBackground from "@/components/ui/TechGridBackground";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen text-foreground">
      <TechGridBackground />
      <div className="relative z-10">
        <Navigation />
        <main className="mx-auto flex min-h-screen max-w-[1246px] flex-col items-start justify-center px-6 pb-16 pt-32 xl:px-0">
          <p className="flex items-center font-mono text-[11px] tracking-[0.3em] text-[#0B1726]">
            ERROR 404 <span className="ml-4 inline-block h-px w-14 bg-primary" />
          </p>
          <h1 className="mt-4 font-display text-[56px] font-extrabold uppercase leading-[0.98] tracking-tight text-[#0B1726] md:text-[88px]">
            Signal <span className="text-primary">lost.</span>
          </h1>
          <p className="mt-5 max-w-md text-[16px] leading-6 text-muted-foreground">
            The page you are looking for does not exist or has moved. Head back and keep exploring.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex h-[42px] items-center gap-3 rounded-[3px] bg-primary px-8 font-body text-[15px] font-medium text-white shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.7)] transition-colors hover:bg-primary/90"
          >
            Return to Home <ArrowRight className="h-5 w-5" strokeWidth={1.75} />
          </Link>
        </main>
      </div>
    </div>
  );
};

export default NotFound;
