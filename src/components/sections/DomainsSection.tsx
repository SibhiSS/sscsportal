import { motion } from 'framer-motion';
import { Brain, Eye, MessageSquareText, Sparkles, Bot, Megaphone, type LucideIcon } from 'lucide-react';
import SectionHeader from '@/components/site/SectionHeader';

interface Domain { icon: LucideIcon; title: string; text: string; tags: string[] }

const DOMAINS: Domain[] = [
  { icon: Brain, title: 'Machine Learning', text: 'From regression to deep nets: study groups, Kaggle sprints and model-building clinics.', tags: ['Python', 'PyTorch', 'Kaggle'] },
  { icon: Sparkles, title: 'Generative AI', text: 'Prompting, fine-tuning and shipping LLM apps with real APIs, not slideware.', tags: ['LLMs', 'RAG', 'Agents'] },
  { icon: Eye, title: 'Computer Vision', text: 'Teach machines to see: detection, segmentation and edge deployment projects.', tags: ['OpenCV', 'YOLO', 'Edge'] },
  { icon: MessageSquareText, title: 'Natural Language', text: 'Text, speech and language tools for Indian languages and campus problems.', tags: ['NLP', 'Speech', 'Chatbots'] },
  { icon: Bot, title: 'Robotics & IoT', text: 'Intelligent machines that sense and act: ROS, microcontrollers and smart devices.', tags: ['ROS', 'Arduino', 'Sensors'] },
  { icon: Megaphone, title: 'Design & Outreach', text: 'Brand, content, partnerships and events that keep the community growing.', tags: ['Design', 'Social', 'Events'] },
];

const DomainsSection = () => (
  <section id="domains" className="py-16 md:py-20">
    <div className="mx-auto max-w-[1246px] px-6 xl:px-0">
      <SectionHeader
        eyebrow="What we do"
        title={<>Six ways to <span className="text-primary">build with AI.</span></>}
        intro="Pick a track, join a squad and ship something. Every domain runs workshops, mini-projects and a flagship build each semester."
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DOMAINS.map((d, i) => (
          <motion.article
            key={d.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
            className="group flex flex-col rounded-md border border-border bg-white/80 p-6 shadow-[0_8px_24px_-18px_rgba(15,58,107,0.3)] transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_16px_32px_-16px_rgba(49,135,232,0.35)]"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <d.icon className="h-6 w-6" strokeWidth={1.6} />
              </span>
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <h3 className="mt-5 font-heading text-lg font-bold text-[#0B1726]">{d.title}</h3>
            <p className="mt-2 flex-1 text-[14px] leading-[22px] text-muted-foreground">{d.text}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {d.tags.map(t => (
                <span key={t} className="rounded-[3px] bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary">{t}</span>
              ))}
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  </section>
);

export default DomainsSection;
