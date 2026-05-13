import Navigation from '@/components/Navigation';
import TechGridBackground from '@/components/ui/TechGridBackground';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import DomainsSection from '@/components/sections/DomainsSection';
import EventsSection from '@/components/sections/EventsSection';
import JoinSection from '@/components/sections/JoinSection';
import ContactSection from '@/components/sections/ContactSection';

const Index = () => {
  return (
    <div className="min-h-screen text-foreground relative">
      <TechGridBackground />
      <div className="relative z-10">
        <Navigation />
        <main>
          <HeroSection />
          <AboutSection />
          <DomainsSection />
          <EventsSection />
          <JoinSection />
          <ContactSection />
        </main>
      </div>
    </div>
  );
};

export default Index;
