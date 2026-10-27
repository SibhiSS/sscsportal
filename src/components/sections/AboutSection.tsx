import { motion } from 'framer-motion';
import { Code2, Users, Lightbulb, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// Learn and Collaborate share the "people" glyph in the design; Collaborate's is the bolder group.
const PILLARS = [
  { icon: Users, title: 'Learn', text: 'Gain hands-on experience' },
  { icon: Code2, title: 'Build', text: 'Work on real projects' },
  { icon: Users, title: 'Collaborate', text: 'Meet like-minded peers' },
  { icon: Lightbulb, title: 'Create Impact', text: 'Use AI for real-world problems' },
];

const AboutSection = () => {
  return (
    <section id="about" className="relative bg-[#EBF1FA] py-12 lg:py-0">
      <div className="mx-auto grid max-w-[1246px] gap-10 px-6 lg:h-[248px] lg:grid-cols-[462px_1fr] lg:items-center lg:gap-0 lg:px-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="lg:py-5"
        >
          <p className="flex items-center font-mono text-[11px] tracking-[0.3em] text-[#0B1726]">
            WHO WE ARE <span className="ml-4 inline-block h-px w-16 bg-primary" />
          </p>
          <h2 className="mt-5 font-display text-[30px] font-extrabold uppercase leading-[31px] tracking-tight text-[#0B1726]">
            A community <br />
            for <span className="text-primary">what’s next.</span>
          </h2>
          <p className="mt-4 max-w-[340px] text-[15px] leading-[22px] text-muted-foreground">
            We organize workshops, talks, hackathons and collaborative projects to learn, build and create impact with AI.
          </p>
          <Link to="/team" className="mt-5 inline-flex items-center gap-2 text-[14px] font-medium text-primary hover:underline">
            Learn More <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:h-[180px] lg:grid-cols-4 lg:items-start lg:border-l lg:border-border lg:pt-0">
          {PILLARS.map((p, i) => (
            <motion.div
              key={`${p.title}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-4 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white/70 text-primary shadow-[0_6px_20px_-10px_rgba(49,135,232,0.35)]">
                <p.icon className="h-8 w-8" strokeWidth={1.5} />
              </div>
              <h3 className="font-heading text-base font-bold text-[#0B1726]">{p.title}</h3>
              <p className="mt-2 max-w-[160px] text-[15px] leading-[22px] text-muted-foreground">{p.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
