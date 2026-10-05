import { motion } from 'framer-motion';
import { Mail, MapPin, Linkedin, Instagram, MessageCircle } from 'lucide-react';
import ScrambleText from '@/components/fx/ScrambleText';

const socialLinks = [
  { icon: Linkedin, href: 'https://www.linkedin.com/company/ieee-sscs-vitc/', label: 'LinkedIn' },
  { icon: Instagram, href: 'https://www.instagram.com/ieee_sscs_vitcc/', label: 'Instagram' },
  { icon: MessageCircle, href: 'https://chat.whatsapp.com/Em8uoQtYNPcFTsg3w0dVdo?s=qt&p=a&ilr=1', label: 'WhatsApp' },
];

const ContactSection = () => {
  return (
    <section id="contact" className="py-16 md:py-24 relative">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs text-primary tracking-[0.3em] uppercase mb-3 block font-medium">
            Connect
          </span>
          <h2 className="font-heading text-[1.75rem] leading-tight sm:text-4xl md:text-5xl font-bold text-foreground">
            <ScrambleText text="Get in Touch" />
          </h2>
        </motion.div>

        {/* Contact Info */}
        <div className="max-w-2xl mx-auto">
          <motion.div
            className="flex flex-wrap justify-center gap-6 mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <a
              href="mailto:ieee.sscs.vitchennai@gmail.com"
              className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/[0.08] backdrop-blur-xl transition-all group"
            >
              <Mail className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium text-foreground/80">ieee.sscs.vitchennai@gmail.com</span>
            </a>
            <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
              <MapPin className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-foreground/80 text-center">VIT Chennai, India</span>
            </div>
          </motion.div>

          {/* Social Links */}
          <motion.div
            className="flex justify-center gap-4"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/[0.08] backdrop-blur-xl hover:text-primary transition-all group"
                aria-label={social.label}
              >
                <social.icon className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </a>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
