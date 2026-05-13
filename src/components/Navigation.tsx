import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogIn, LogOut, User as UserIcon, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
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
  const [hasApplied, setHasApplied] = useState(false);
  const location = useLocation();
  const { user, signInWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        setHasApplied(false);
        return;
      }
      const { data } = await supabase
        .from('applications')
        .select('id')
        .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
        .limit(1);

      if (data && data.length > 0) setHasApplied(true);
      else setHasApplied(false);
    };

    checkStatus();
  }, [user]);

  const navLinks = [
    { name: 'About', href: '#about' },
    { name: 'Team', href: '/team' },
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
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
          ? 'bg-background/90 backdrop-blur-md border-b border-border'
          : 'bg-transparent'
          }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="#" className="flex items-center gap-2">
              <img src="/logo.png" alt="IEEE SSCS Logo" className="w-8 h-8 object-contain" />
              <span className="font-heading font-bold text-lg">
                <span className="text-primary">IEEE</span>
                <span className="text-foreground"> SSCS</span>
              </span>
            </a>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <button
                  key={link.name}
                  onClick={() => handleNavClick(link.href)}
                  className="relative group px-3 py-1 text-sm text-foreground/80 hover:text-primary transition-colors"
                >
                  <span className="relative z-10">{link.name}</span>
                  <span className="absolute inset-0 rounded bg-primary/10 scale-0 group-hover:scale-100 transition-transform duration-200" />
                  <span className="absolute bottom-0 left-0 w-full h-[1px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                </button>
              ))}

              {hasApplied ? (
                <Button size="sm" variant="outline" className="border-primary/20 text-primary/50 cursor-not-allowed" disabled>
                  Applied
                </Button>
              ) : (
                <Link to="/apply">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Join Us
                  </Button>
                </Link>
              )}

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL} alt={user.displayName} />
                        <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {hasApplied && (
                      <DropdownMenuItem onClick={() => navigate('/apply')}>
                        <Eye className="mr-2 h-4 w-4" />
                        <span>Application Status</span>
                      </DropdownMenuItem>
                    )}
                    {/* ONLY show dashboard link if user has an admin role */}
                    {user.role && ['super_admin', 'admin', 'interviewer'].includes(user.role) && (
                      <DropdownMenuItem onClick={() => {
                        if (user.role === 'super_admin' || user.role === 'admin') {
                          navigate('/admin');
                        } else {
                          navigate('/interviewer');
                        }
                      }}>
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>{user.role === 'super_admin' || user.role === 'admin' ? 'Admin Dashboard' : 'Interviewer Dashboard'}</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/20 hover:bg-primary/10"
                  onClick={signInWithGoogle}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center justify-center h-full gap-8 pt-16">
              {navLinks.map((link) => (
                <button
                  key={link.name}
                  onClick={() => handleNavClick(link.href)}
                  className="font-heading text-xl text-foreground hover:text-primary transition-colors"
                >
                  {link.name}
                </button>
              ))}
              {hasApplied ? (
                <Button variant="outline" className="border-primary/20 text-primary/50 cursor-not-allowed w-[120px]" disabled>
                  Applied
                </Button>
              ) : (
                <Link to="/apply" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Join Us
                  </Button>
                </Link>
              )}

              {user ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL} />
                      <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{user.displayName}</span>
                  </div>
                  <Button variant="outline" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Log Out
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => { signInWithGoogle(); setIsMobileMenuOpen(false); }}>
                  <LogIn className="w-4 h-4 mr-2" />
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
