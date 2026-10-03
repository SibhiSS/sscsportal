import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogIn, LogOut, User as UserIcon, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, signInWithGoogle, loginAsLocalAdmin, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Get out of the way of the full-screen footer (and its game) once at least half of it is on screen.
  const [footerInView, setFooterInView] = useState(false);
  useEffect(() => {
    const check = () => {
      const footer = document.querySelector('footer');
      if (!footer) { setFooterInView(false); return; }
      const r = footer.getBoundingClientRect();
      const visible = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
      setFooterInView(visible >= Math.min(r.height, window.innerHeight) * 0.5);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [location.pathname]);

  const navLinks = [
    { name: 'About', href: '#about' },
    { name: 'Team', href: '/team' },
    { name: 'Leaderboard', href: '/leaderboard' },
    { name: 'Domains', href: '#domains' },
    { name: 'Events', href: '#events' },
    { name: 'Contact', href: '#contact' },
  ];

  const handleNavClick = (href: string) => {
    if (href.startsWith('/')) {
      navigate(href);
      setIsMobileMenuOpen(false);
      window.scrollTo(0, 0);
      return;
    }

    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.querySelector(href);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none pt-6 px-6"
        animate={{ y: footerInView ? -140 : 0, opacity: footerInView ? 0 : 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        aria-hidden={footerInView || undefined}
      >
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`
            pointer-events-auto grid grid-cols-[minmax(max-content,1fr)_auto] md:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-4 px-6 py-3 transition-[max-width,background-color,border-color,box-shadow,border-radius] duration-500
            ${isScrolled 
              ? 'w-full max-w-5xl rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]' 
              : 'w-full max-w-7xl bg-transparent border-transparent'
            }
          `}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group justify-self-start">
            <div className="relative">
              <img src="/logo.png" alt="IEEE SSCS Logo" className="w-8 h-8 object-contain relative z-10 transition-transform group-hover:scale-110" />
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="font-heading font-bold text-lg hidden sm:block whitespace-nowrap">
              <span className="text-primary tracking-tight">IEEE</span>
              <span className="text-foreground tracking-tight"> SSCS</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => handleNavClick(link.href)}
                className="px-3 lg:px-4 py-2 text-sm font-medium whitespace-nowrap text-foreground/70 hover:text-primary transition-all rounded-full hover:bg-white/5 relative overflow-hidden group"
              >
                <span className="relative z-10">{link.name}</span>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 justify-self-end">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-white/10 p-0 overflow-hidden hover:bg-white/10">
                    <Avatar className="h-full w-full">
                      <AvatarImage src={user.photoURL} alt={user.displayName} />
                      <AvatarFallback className="bg-white/10 text-foreground text-xs">{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-black/80 backdrop-blur-2xl border-white/10 text-foreground p-2 rounded-2xl mt-4" align="end">
                  <DropdownMenuLabel className="font-normal p-4">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/5" />
                  <div className="p-1">
                    <DropdownMenuItem onClick={() => navigate('/me')} className="rounded-xl focus:bg-white/10 cursor-pointer p-3">
                      <Award className="mr-3 h-4 w-4 text-primary" />
                      <span>My Contributions</span>
                    </DropdownMenuItem>
                    {(user.role === 'super_admin' || user.role === 'admin') && (
                      <DropdownMenuItem onClick={() => navigate('/admin')} className="rounded-xl focus:bg-white/10 cursor-pointer p-3">
                        <UserIcon className="mr-3 h-4 w-4 text-primary" />
                        <span>Admin Dashboard</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={logout} className="rounded-xl focus:bg-red-500/20 text-red-400 cursor-pointer p-3">
                      <LogOut className="mr-3 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                {import.meta.env.DEV && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="hidden sm:flex border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-full px-4 text-xs font-mono font-bold"
                    onClick={() => {
                      loginAsLocalAdmin();
                      if (location.pathname !== '/admin') navigate('/admin');
                    }}
                    title="Log in as Super Admin without OAuth (Local Dev Only)"
                  >
                    ⚡ Dev Bypass
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="hidden sm:flex border-white/10 hover:bg-white/10 text-foreground backdrop-blur-md rounded-full px-6"
                  onClick={signInWithGoogle}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-foreground hover:bg-white/10 rounded-full transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </motion.nav>
      </motion.div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden bg-black/60 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
              {navLinks.map((link, idx) => (
                <motion.button
                  key={link.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => handleNavClick(link.href)}
                  className="font-heading text-3xl font-bold text-foreground hover:text-primary transition-colors"
                >
                  {link.name}
                </motion.button>
              ))}
              
              <motion.div 
                className="w-full h-[1px] bg-white/10 my-4"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
              />

              {user ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL} />
                      <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold">{user.displayName}</span>
                  </div>
                  <Button variant="outline" className="rounded-full px-8" onClick={() => { navigate('/me'); setIsMobileMenuOpen(false); }}>
                    <Award className="w-4 h-4 mr-2" />
                    My Contributions
                  </Button>
                  {(user.role === 'super_admin' || user.role === 'admin') && (
                    <Button variant="outline" className="rounded-full px-8" onClick={() => { navigate('/admin'); setIsMobileMenuOpen(false); }}>
                      <UserIcon className="w-4 h-4 mr-2" />
                      Admin Dashboard
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-full px-8 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Log Out
                  </Button>
                </div>
              ) : (
                <Button className="w-full max-w-xs bg-primary text-primary-foreground rounded-full h-14 text-lg font-bold" onClick={() => { signInWithGoogle(); setIsMobileMenuOpen(false); }}>
                  <LogIn className="w-5 h-5 mr-3" />
                  Sign In
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navigation;
