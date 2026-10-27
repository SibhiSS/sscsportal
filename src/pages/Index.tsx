import Navigation from '@/components/Navigation';
import TechGridBackground from '@/components/ui/TechGridBackground';
import HeroSection from '@/components/sections/HeroSection';
import AboutSection from '@/components/sections/AboutSection';
import UpcomingEventsSection from '@/components/sections/UpcomingEventsSection';
import DomainsSection from '@/components/sections/DomainsSection';
import EventsSection from '@/components/sections/EventsSection';
import LeaderboardSection from '@/components/sections/LeaderboardSection';
import MembershipSection from '@/components/sections/MembershipSection';
import JoinSection from '@/components/sections/JoinSection';
import SiteFooter from '@/components/SiteFooter';

const Index = () => {
  return (
    <div className="min-h-screen text-foreground relative">
      <TechGridBackground />
      <div className="relative z-10">
        <Navigation />
        <main>
          <HeroSection />
          <AboutSection />
          <UpcomingEventsSection />
          <DomainsSection />
          <EventsSection />
          <LeaderboardSection />
          <MembershipSection />
          <JoinSection />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
};

export default Index;
