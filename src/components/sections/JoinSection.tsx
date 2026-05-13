import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Zap, Users, Award, ArrowRight, Eye } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import { Button } from '@/components/ui/button';
import RevealText from '@/components/ui/RevealText';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const benefits = [
  { icon: Zap, title: 'Hands-on Projects', description: 'Work on real SSCS projects' },
  { icon: Users, title: 'Expert Network', description: 'Connect with industry experts' },
  { icon: Award, title: 'Competitions', description: 'Compete in hackathons' },
];

const JoinSection = () => {
  const { user } = useAuth();
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('applications')
        .select('id')
        .or(`user_id.eq.${user.uid},email.eq.${user.email}`)
        .limit(1);

      if (data && data.length > 0) setHasApplied(true);
    };

    checkStatus();
  }, [user]);

  return (
    <section id="join" className="py-24">
      <div className="container mx-auto px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Rocket className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary">Now Recruiting</span>
          </div>

          {/* Heading */}
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            <span className="text-foreground inline-block mr-2"><RevealText text="Join" /></span>
            <span className="text-primary inline-block"><RevealText text="IEEE SSCS" delay={0.1} /></span>
          </h2>

          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Ready to prototype, connect, and perform? Join our community of
            inIEEEtors and shape the future of cyber-physical systems.
          </p>

          {/* Benefits */}
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {benefits.map((benefit) => (
              <HolographicCard
                key={benefit.title}
                className="p-6 flex flex-col items-center hover:border-primary/30"
              >
                <div className="p-3 rounded-full bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-foreground text-sm mb-2">
                  {benefit.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {benefit.description}
                </p>
              </HolographicCard>
            ))}
          </div>

          {/* CTA Button */}
          {hasApplied ? (
            <Button
              size="lg"
              className="bg-primary/20 text-primary/50 border border-primary/20 font-heading cursor-not-allowed"
              disabled
            >
              Application Received
            </Button>
          ) : (
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading"
              asChild
            >
              <Link to="/apply">
                Apply Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            Applications are reviewed on a rolling basis
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default JoinSection;
