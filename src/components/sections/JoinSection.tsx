import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import { Button } from '@/components/ui/button';
import RevealText from '@/components/ui/RevealText';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const benefits = [
  { title: 'Hands-on Projects', description: 'Work on real SSCS projects' },
  { title: 'Expert Network', description: 'Connect with industry experts' },
  { title: 'Competitions', description: 'Compete in hackathons' },
];

const JoinSection = () => {
  const { user } = useAuth();
  const [hasApplied, setHasApplied] = useState(false);
  const [canBookSlot, setCanBookSlot] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [isRecruitmentOpen, setIsRecruitmentOpen] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      // HARDCODED CLOSED
      setIsRecruitmentOpen(false);

      if (!user) return;
      const { data } = await supabase
        .from('applications')
        .select('id, status')
        .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
        .limit(1);

      if (data && data.length > 0) {
        setHasApplied(true);
        const st = data[0].status;
        if (st === 'shortlisted') {
          setCanBookSlot(true);
        } else if (['selected', 'active_member'].includes(st)) {
          setIsSelected(true);
        }
      }
    };

    checkStatus();
  }, [user]);

  return (
    <section id="join" className="py-24 relative">
      <div className="container mx-auto px-6">
        <motion.div
          className="max-w-6xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-10 backdrop-blur-sm">
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">Now Recruiting</span>
          </div>

          {/* Heading */}
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground mb-6">
            Join the Next Generation of <br />
            <span className="text-primary">Silicon Engineers</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get hands-on experience with industry-standard EDA tools, participate in tapeouts, 
            and build a network with top semiconductor professionals.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-3 gap-6 mt-16 mb-16 relative z-10 max-w-5xl mx-auto">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <HolographicCard 
                key={benefit.title}
                className="p-8 flex flex-col items-center group transition-all duration-500"
              >
                <h3 className="font-heading font-bold text-foreground text-xl mb-3 pt-6">
                  {benefit.title}
                </h3>
                <p className="text-sm text-muted-foreground/80 font-medium">
                  {benefit.description}
                </p>
              </HolographicCard>
            </motion.div>
          ))}
        </div>

          {/* CTA Button */}
          <div className="flex flex-col items-center">
            {canBookSlot ? (
              <Button
                size="lg"
                className="px-12 h-16 bg-purple-600 hover:bg-purple-700 text-white font-heading rounded-full shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all hover:scale-105 text-lg animate-pulse"
                asChild
              >
                <Link to="/schedule">
                  BOOK SLOT
                  <ArrowRight className="w-6 h-6 ml-2" />
                </Link>
              </Button>
            ) : isSelected ? (
              <Button
                size="lg"
                className="px-12 h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-heading rounded-full shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all hover:scale-105 text-lg"
                asChild
              >
                <Link to="/apply">
                  APPLICATION SELECTED
                  <ArrowRight className="w-6 h-6 ml-2" />
                </Link>
              </Button>
            ) : hasApplied ? (
              <Button
                size="lg"
                className="px-10 h-14 bg-primary/20 text-primary/50 border border-primary/20 font-heading cursor-not-allowed rounded-full"
                disabled
              >
                Application Received
              </Button>
            ) : !isRecruitmentOpen ? (
              <Button
                size="lg"
                className="px-12 h-16 bg-white/5 border border-white/10 text-muted-foreground font-heading rounded-full text-lg cursor-not-allowed"
                disabled
              >
                RECRUITMENT CLOSED
              </Button>
            ) : (
              <Button
                size="lg"
                className="px-12 h-16 bg-primary text-primary-foreground hover:bg-primary/90 font-heading rounded-full shadow-[0_0_25px_rgba(220,20,60,0.3)] transition-all hover:scale-105 text-lg"
                asChild
              >
                <Link to="/apply">
                  Apply Now
                  <ArrowRight className="w-6 h-6 ml-2" />
                </Link>
              </Button>
            )}

            <p className="text-sm text-muted-foreground mt-8 font-medium">
              Applications are reviewed on a rolling basis
            </p>
          </div>
      </div>
    </section>
  );
};

export default JoinSection;
