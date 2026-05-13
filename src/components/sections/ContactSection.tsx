import { motion } from 'framer-motion';
import { Mail, MapPin, Linkedin, Instagram } from 'lucide-react';
import RevealText from '@/components/ui/RevealText';

const socialLinks = [
  { icon: Linkedin, href: 'https://in.linkedin.com/company/ieee-sscs-vitc', label: 'LinkedIn' },
  { icon: Instagram, href: 'https://www.instagram.com/ieee_sscs_vitcc/', label: 'Instagram' },
];

const ContactSection = () => {
  return (
    <section id="contact" className="py-24 relative">
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
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground">
            <RevealText text="Get in Touch" />
          </h2>
        </motion.div>

        {/* Contact Info */}
        <div className="max-w-2xl mx-auto mb-20">
          <motion.div
            className="flex flex-wrap justify-center gap-6 mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <a
              href="mailto:IEEE.SSCSc@gmail.com"
              className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/[0.08] backdrop-blur-xl transition-all group"
            >
              <Mail className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium text-foreground/80">ieee.sscsc@gmail.com</span>
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

        {/* Slimmed Footer */}
        <motion.footer
          className="relative pt-8 mt-8 border-t border-white/5"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-6">
            <div className="flex items-center gap-3 group">
              <div className="relative">
                <img src="/logo.png" alt="IEEE SSCS" className="w-8 h-8 object-contain relative z-10 transition-transform group-hover:rotate-12" />
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="font-heading font-bold text-base">
                <span className="text-primary">IEEE</span>
                <span className="text-foreground"> SSCS</span>
              </span>
            </div>

            <p className="text-xs text-muted-foreground/80 font-medium italic">
              Innovating the World of Integrated Circuits
            </p>

            <div className="flex flex-col items-center md:items-end gap-1">
              <p className="text-[9px] text-muted-foreground/60 tracking-widest uppercase font-mono">
                Design • Fabricate • Test
              </p>
              <p className="text-[10px] text-muted-foreground/80 font-medium">
                © 2026 IEEE SSCS Portal
              </p>
            </div>
          </div>
        </motion.footer>
      </div>
    </section>
  );
};

export default ContactSection;
