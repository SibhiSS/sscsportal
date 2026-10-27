import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X, LogIn, LogOut, User as UserIcon, Award, ClipboardList, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandLogo from '@/components/site/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRecruitmentWindow } from '@/hooks/useRecruitmentWindow';
import { RECRUITMENT_CLOSED } from '@/config/recruitment';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
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
  const [hasApplied, setHasApplied] = useState(false);
  // Server-evaluated: the manual switch AND the scheduled window.
  const { isOpen: isRecruitmentOpen } = useRecruitmentWindow();
  const flags = useFeatureFlags();

  useEffect(() => {
    if (!user) {
      setHasApplied(false);
      return;
    }
    supabase
      .from('applications')
      .select('id')
      .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
      .limit(1)
      .then(({ data }) => setHasApplied(!!data && data.length > 0));
  }, [user]);

  // One recruitment call-to-action, used by both the desktop bar and the mobile menu.
  // Hidden entirely while recruitment is closed.
  const joinCta = RECRUITMENT_CLOSED
    ? null
    : hasApplied
      ? { label: 'Applied', to: undefined, href: undefined, disabled: true }
      : !isRecruitmentOpen
        ? { label: 'Closed', to: undefined, href: undefined, disabled: true }
        : { label: 'Join Us', to: '/apply', href: undefined, disabled: false };

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

  // Lock the page behind the open mobile menu, and close the menu if the screen grows past the breakpoint.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const mq = window.matchMedia('(min-width: 1024px)');
    const close = () => { if (mq.matches) setIsMobileMenuOpen(false); };
    mq.addEventListener('change', close);
    return () => {
      document.body.style.overflow = prev;
      mq.removeEventListener('change', close);
    };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '#about' },
    { name: 'Events', href: '#events' },
    { name: 'Team', href: '/team' },
    { name: 'Leaderboard', href: '/leaderboard' },
    { name: 'Propose', href: '/proposals' },
  ];

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' && !location.hash : href.startsWith('/') && location.pathname.startsWith(href);

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
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none pt-3 px-3 sm:pt-6 sm:px-6"
        animate={{ y: footerInView ? -140 : 0, opacity: footerInView ? 0 : 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        aria-hidden={footerInView || undefined}
      >
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`
            pointer-events-auto grid grid-cols-[minmax(max-content,1fr)_auto] lg:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-4 px-4 sm:px-6 py-2.5 sm:py-3 transition-[max-width,background-color,border-color,box-shadow,border-radius] duration-500
            ${isScrolled 
              ? 'w-full max-w-[1246px] rounded-md bg-white/90 border border-border backdrop-blur-xl shadow-[0_8px_24px_-14px_rgba(15,58,107,0.3)]'
              : 'w-full max-w-[1246px] bg-transparent border-transparent'
            }
          `}
        >
          {/* Logo */}
          <BrandLogo className="justify-self-start" />

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => handleNavClick(link.href)}
                className={`group relative px-4 py-2 text-[14px] font-medium whitespace-nowrap transition-colors hover:text-primary ${isActive(link.href) ? 'text-primary' : 'text-[#0B1726]'}`}
              >
                {link.name}
                <span className={`absolute inset-x-4 -bottom-0.5 h-0.5 bg-primary transition-transform origin-left ${isActive(link.href) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 justify-self-end">
            <div className="hidden sm:flex items-center gap-3">
              {joinCta && (joinCta.href ? (
                <Button size="sm" variant="outline" className="border-foreground/10 text-muted-foreground hover:text-foreground rounded-[3px] bg-white px-6" asChild>
                  <a href={joinCta.href} target="_blank" rel="noopener noreferrer">{joinCta.label}</a>
                </Button>
              ) : joinCta.disabled ? (
                <Button size="sm" variant="outline" className="border-foreground/10 text-muted-foreground rounded-[3px] bg-white cursor-not-allowed px-6" disabled>
                  {joinCta.label}
                </Button>
              ) : (
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-[3px] px-6 shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.7)] font-medium" onClick={() => navigate(joinCta.to!)}>
                  {joinCta.label} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ))}
            </div>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-border p-0 overflow-hidden hover:bg-primary/10">
                    <Avatar className="h-full w-full">
                      <AvatarImage src={user.photoURL} alt={user.displayName} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-white border-border text-foreground p-2 rounded-md mt-4 shadow-[0_16px_32px_-16px_rgba(15,58,107,0.3)]" align="end">
                  <DropdownMenuLabel className="font-normal p-4">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <div className="p-1">
                    <DropdownMenuItem onClick={() => navigate('/me')} className="rounded-md focus:bg-primary/10 cursor-pointer p-3">
                      <Award className="mr-3 h-4 w-4 text-primary" />
                      <span>My Contributions</span>
                    </DropdownMenuItem>
                    {(user.role === 'super_admin' || user.role === 'admin' || user.role === 'external') && (
                      <DropdownMenuItem onClick={() => navigate('/admin')} className="rounded-md focus:bg-primary/10 cursor-pointer p-3">
                        <UserIcon className="mr-3 h-4 w-4 text-primary" />
                        <span>Admin Dashboard</span>
                      </DropdownMenuItem>
                    )}
                    {((user.role === 'interviewer') || ((user.role === 'super_admin' || user.role === 'admin') && flags.recruitment)) && (
                      <DropdownMenuItem onClick={() => navigate('/admin/recruitment')} className="rounded-md focus:bg-primary/10 cursor-pointer p-3">
                        <ClipboardList className="mr-3 h-4 w-4 text-primary" />
                        <span>Recruitment</span>
                      </DropdownMenuItem>
                    )}
                    {user.role === 'interviewer' && (
                      <DropdownMenuItem onClick={() => navigate('/interviewer')} className="rounded-md focus:bg-primary/10 cursor-pointer p-3">
                        <Video className="mr-3 h-4 w-4 text-primary" />
                        <span>My Interviews</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={logout} className="rounded-md focus:bg-destructive/10 text-destructive cursor-pointer p-3">
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
                    className="hidden sm:flex border-amber-500/40 text-amber-600 hover:bg-amber-500/10 rounded-[3px] px-4 text-xs font-mono font-bold"
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
                  className="hidden sm:flex border-border bg-white hover:bg-primary/5 text-[#0B1726] rounded-[3px] px-6"
                  onClick={signInWithGoogle}
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2.5 -mr-1.5 text-foreground hover:bg-primary/10 rounded-md transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
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
            className="fixed inset-0 z-40 lg:hidden overflow-y-auto overscroll-contain bg-[#F4F8FD]/95 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center justify-center min-h-full gap-5 px-6 pt-24 pb-10">
              {navLinks.map((link, idx) => (
                <motion.button
                  key={link.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => handleNavClick(link.href)}
                  className="font-heading text-2xl sm:text-3xl font-bold text-foreground hover:text-primary transition-colors py-1"
                >
                  {link.name}
                </motion.button>
              ))}
              
              {joinCta && (joinCta.href ? (
                <Button asChild className="w-full max-w-xs rounded-[3px] h-12 text-base font-bold" variant="outline">
                  <a href={joinCta.href} target="_blank" rel="noopener noreferrer">{joinCta.label}</a>
                </Button>
              ) : joinCta.disabled ? (
                <Button disabled className="w-full max-w-xs rounded-[3px] h-12 text-base font-bold" variant="outline">{joinCta.label}</Button>
              ) : (
                <Button className="w-full max-w-xs bg-primary text-primary-foreground rounded-[3px] h-12 text-base font-bold" onClick={() => { navigate(joinCta.to!); setIsMobileMenuOpen(false); }}>{joinCta.label}</Button>
              ))}

              <motion.div
                className="w-full h-[1px] bg-border my-4"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
              />

              {user ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center gap-3 px-6 py-3 rounded-md bg-white border border-border">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL} />
                      <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold">{user.displayName}</span>
                  </div>
                  <Button variant="outline" className="rounded-[3px] px-8" onClick={() => { navigate('/me'); setIsMobileMenuOpen(false); }}>
                    <Award className="w-4 h-4 mr-2" />
                    My Contributions
                  </Button>
                  {(user.role === 'super_admin' || user.role === 'admin' || user.role === 'external') && (
                    <Button variant="outline" className="rounded-[3px] px-8" onClick={() => { navigate('/admin'); setIsMobileMenuOpen(false); }}>
                      <UserIcon className="w-4 h-4 mr-2" />
                      Admin Dashboard
                    </Button>
                  )}
                  {((user.role === 'interviewer') || ((user.role === 'super_admin' || user.role === 'admin') && flags.recruitment)) && (
                    <Button variant="outline" className="rounded-[3px] px-8" onClick={() => { navigate('/admin/recruitment'); setIsMobileMenuOpen(false); }}>
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Recruitment
                    </Button>
                  )}
                  {user.role === 'interviewer' && (
                    <Button variant="outline" className="rounded-[3px] px-8" onClick={() => { navigate('/interviewer'); setIsMobileMenuOpen(false); }}>
                      <Video className="w-4 h-4 mr-2" />
                      My Interviews
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-[3px] px-8 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Log Out
                  </Button>
                </div>
              ) : (
                <Button className="w-full max-w-xs bg-primary text-primary-foreground rounded-[3px] h-14 text-lg font-bold" onClick={() => { signInWithGoogle(); setIsMobileMenuOpen(false); }}>
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
