import { motion } from 'framer-motion';
import SectionHeader from '@/components/site/SectionHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const STEPS = [
  { n: '01', title: 'Join the club', body: 'Recruitment is announced on our Instagram. Once selected, sign in with your VIT Google account to reach the member portal.' },
  { n: '02', title: 'Build and contribute', body: 'Run events, teach a workshop, design, write or bring in partners. Log each contribution with proof and an admin reviews it.' },
  { n: '03', title: 'Climb the leaderboard', body: 'Event roles and approved contributions earn points, and everyone ranked shows up on the public leaderboard.' },
];

const FAQ = [
  { q: 'Who can join?', a: 'Students of VIT Chennai. Recruitment drives are announced on our Instagram and WhatsApp community.' },
  { q: 'Do I need to know AI already?', a: 'No. Curiosity is enough. We run beginner tracks, and there are non-technical domains too: management, events, design and outreach.' },
  { q: 'How do I sign in?', a: 'With your VIT Google account, ending in @vitstudent.ac.in or @vit.ac.in.' },
  { q: 'How do points work?', a: 'You earn points for your role at an event, marked by an admin, and for contributions you log that an admin approves. Leads coordinate the work and are not ranked.' },
  { q: 'How do I log a contribution?', a: 'Sign in, open My Contributions, pick what you did, attach a link or photos as proof and submit. You get a short code to track it.' },
  { q: 'Where do I hear about events?', a: 'In the Events section on this page, and on our Instagram and WhatsApp community.' },
];

const MembershipSection = () => (
  <section id="membership" className="bg-[#EBF1FA] py-16 md:py-20">
    <div className="mx-auto max-w-[1246px] px-6 xl:px-0">
      <SectionHeader eyebrow="Membership" title={<>How it <span className="text-primary">works.</span></>} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <ol className="relative space-y-8 border-l border-primary/30 pl-8">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative"
            >
              <span className="absolute -left-[41px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-primary bg-white">
                <span className="h-2 w-2 rounded-full bg-primary" />
              </span>
              <p className="font-mono text-[11px] tracking-[0.3em] text-primary">STEP {s.n}</p>
              <h3 className="mt-1 font-heading text-xl font-bold text-[#0B1726]">{s.title}</h3>
              <p className="mt-2 max-w-md text-[15px] leading-6 text-muted-foreground">{s.body}</p>
            </motion.li>
          ))}
        </ol>

        <div className="rounded-md border border-border bg-white/80 px-6 py-2 shadow-[0_8px_24px_-18px_rgba(15,58,107,0.3)]">
          <Accordion type="single" collapsible>
            {FAQ.map((item, i) => (
              <AccordionItem key={item.q} value={`q${i}`} className="border-border last:border-b-0">
                <AccordionTrigger className="text-left font-heading text-[15px] font-semibold text-[#0B1726] hover:text-primary hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-[14px] leading-6 text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  </section>
);

export default MembershipSection;
