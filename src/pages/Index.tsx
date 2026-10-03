import Navigation from '@/components/Navigation';
import TechGridBackground from '@/components/ui/TechGridBackground';
import HeroSection from '@/components/sections/HeroSection';
import Marquee from '@/components/fx/Marquee';
import AboutSection from '@/components/sections/AboutSection';
import DomainsSection from '@/components/sections/DomainsSection';
import EventsSection from '@/components/sections/EventsSection';
import LeaderboardSection from '@/components/sections/LeaderboardSection';
import MembershipSection from '@/components/sections/MembershipSection';
import ContactSection from '@/components/sections/ContactSection';

const PERKS = ['Real Hardware', 'Any Simulator', 'No Hierarchy', 'Tape-out Dreams', 'Ship Circuits', 'Free Workshops', 'Late-night Debugging'];

const Index = () => {
  return (
    <div className="min-h-screen text-foreground relative">
      <TechGridBackground />
      <div className="relative z-10">
        <Navigation />
        <main>
          <HeroSection />
          <Marquee items={PERKS} />
          <AboutSection />
          <DomainsSection />
          <EventsSection />
          <LeaderboardSection />
          <MembershipSection />
          <ContactSection />
        </main>
      </div>
    </div>
  );
};

export default Index;
