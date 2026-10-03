import { motion } from 'framer-motion';
import HolographicCard from '@/components/ui/HolographicCard';
import ScrambleText from '@/components/fx/ScrambleText';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const STEPS = [
  {
    n: '01',
    title: 'Join the chapter',
    body: 'Recruitment is announced on our Instagram. Once you are selected, sign in with your VIT Google account to reach the member portal.',
  },
  {
    n: '02',
    title: 'Build and contribute',
    body: 'Run events, teach a workshop, design, write or bring in sponsors. Log each contribution with proof and an admin reviews it.',
  },
  {
    n: '03',
    title: 'Climb the leaderboard',
    body: 'Event roles and approved contributions earn points. Everyone ranked shows up on the public leaderboard.',
  },
];

const FAQ = [
  {
    q: 'Who can join?',
    a: 'Students of VIT Chennai. Recruitment drives are announced on our Instagram and WhatsApp community.',
  },
  {
    q: 'Do I need to be good at circuits already?',
    a: 'No. Alongside the technical domain there are five more: management, event operations, creative, outreach and partnerships, and human resources.',
  },
  {
    q: 'How do I sign in?',
    a: 'With your VIT Google account, ending in @vitstudent.ac.in or @vit.ac.in.',
  },
  {
    q: 'How do points work?',
    a: 'You earn points for your role at an event, marked by an admin, and for contributions you log that an admin approves. Leads coordinate the work and are not ranked.',
  },
  {
    q: 'How do I log a contribution?',
    a: 'Sign in, open My Contributions, pick what you did, attach a link or photos as proof and submit. You get a short code to track it while it is reviewed.',
  },
  {
    q: 'Where do I hear about events?',
    a: 'Upcoming events appear in the Events section on this page, and on our Instagram and WhatsApp community.',
  },
];

const MembershipSection = () => (
  <section id="membership" className="py-24 relative">
    <div className="container mx-auto px-6">
      <motion.div
        className="text-center mb-16 max-w-6xl mx-auto px-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <span className="text-xs text-primary tracking-[0.3em] uppercase mb-3 block font-medium">
          Membership
        </span>
        <h2 className="font-heading text-4xl font-bold text-foreground">
          <ScrambleText text="How It Works" />
        </h2>
      </motion.div>

      {/* Three steps */}
      <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto mb-16">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <HolographicCard className="p-8 h-full">
              <span className="text-xs font-mono text-primary uppercase tracking-[0.2em]">{step.n}.</span>
              <h3 className="font-heading text-xl font-bold text-foreground mt-3 mb-4">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </HolographicCard>
          </motion.div>
        ))}
      </div>

      {/* FAQ */}
      <motion.div
        className="max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <HolographicCard className="px-6 py-2 sm:px-8">
          <Accordion type="single" collapsible>
            {FAQ.map((item, i) => (
              <AccordionItem key={item.q} value={`q${i}`} className="border-white/5 last:border-b-0">
                <AccordionTrigger className="text-left font-heading text-sm md:text-base text-foreground hover:text-primary hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </HolographicCard>
      </motion.div>
    </div>
  </section>
);

export default MembershipSection;
