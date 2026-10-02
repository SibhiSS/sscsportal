import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, LogIn, LogOut, ShieldAlert, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import HolographicCard from '@/components/ui/HolographicCard';
import LogoSpinner from '@/components/ui/LogoSpinner';
import TechGridBackground from '@/components/ui/TechGridBackground';

const Admin = () => {
    const { user, loading, error, signInWithGoogle, loginAsLocalAdmin, logout } = useAuth();
    const navigate = useNavigate();

    const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

    if (loading) {
        return <div className="min-h-screen bg-black flex items-center justify-center"><LogoSpinner size="md" /></div>;
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <HolographicCard className="max-w-md w-full text-center p-8">
                    <LayoutDashboard className="w-14 h-14 text-primary mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Admin Panel</h1>
                    <p className="text-muted-foreground mb-6">Sign in with your VIT Google account.</p>
                    {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
                    <div className="space-y-3">
                        <Button onClick={signInWithGoogle} className="w-full">
                            <LogIn className="w-4 h-4 mr-2" />
                            Sign in with Google
                        </Button>
                        <Button onClick={() => navigate('/')} variant="outline" className="w-full">Return Home</Button>
                        {import.meta.env.DEV && (
                            <Button
                                onClick={loginAsLocalAdmin}
                                variant="ghost"
                                className="w-full text-xs text-amber-400 hover:text-amber-300"
                            >
                                Bypass OAuth (local dev only)
                            </Button>
                        )}
                    </div>
                </HolographicCard>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <HolographicCard className="max-w-md w-full text-center p-8 border-red-500/50">
                    <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">Restricted to administrators only.</p>
                    <div className="space-y-3">
                        <Button onClick={() => navigate('/')} variant="outline" className="w-full border-red-500/50 text-red-500 hover:bg-red-950/30">Return Home</Button>
                        <Button onClick={logout} variant="ghost" className="w-full">Sign out</Button>
                    </div>
                </HolographicCard>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-foreground relative overflow-hidden">
            <TechGridBackground />

            <div className="relative z-10 p-6 md:p-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-[1600px] mx-auto space-y-8"
                >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-4">
                            <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-xs tracking-widest uppercase">
                                <ArrowLeft className="w-3 h-3 mr-2 transition-transform group-hover:-translate-x-1" />
                                Home
                            </Link>
                            <h1 className="text-4xl md:text-5xl font-bold font-heading tracking-tight">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-primary to-primary/50">
                                    Admin Panel
                                </span>
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                                {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                            </span>
                            <Button onClick={logout} variant="outline" size="sm" className="h-9">
                                <LogOut className="w-3.5 h-3.5 mr-2" />
                                Sign out
                            </Button>
                        </div>
                    </div>

                    <HolographicCard className="p-10 text-center">
                        <p className="text-lg font-semibold mb-2">Signed in as {user.email}</p>
                        <p className="text-muted-foreground">Members, events, contributions and the calendar will live here.</p>
                    </HolographicCard>
                </motion.div>
            </div>
        </div>
    );
};

export default Admin;
