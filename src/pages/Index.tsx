import Navigation from '@/components/Navigation';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import DomainsSection from '@/components/sections/DomainsSection';
import EventsSection from '@/components/sections/EventsSection';
import JoinSection from '@/components/sections/JoinSection';
import ContactSection from '@/components/sections/ContactSection';

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
  );
};

export default Index;
