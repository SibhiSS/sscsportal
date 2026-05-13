import { motion } from 'framer-motion';
import { Mail, MapPin, Linkedin, Instagram } from 'lucide-react';
import RevealText from '@/components/ui/RevealText';

const socialLinks = [
  { icon: Linkedin, href: 'https://linkedin.com/company/ieee-sscs', label: 'LinkedIn' },
  { icon: Instagram, href: 'https://instagram.com/ieee.sscs', label: 'Instagram' },
];

const ContactSection = () => {
  return (
    <section id="contact" className="py-20 bg-card/50">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs text-primary tracking-widest uppercase mb-2 block">
            Connect
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
            <RevealText text="Get in Touch" />
          </h2>
        </motion.div>

        {/* Contact Info */}
        <div className="max-w-xl mx-auto">
          <motion.div
            className="flex flex-wrap justify-center gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <a
              href="mailto:IEEE.SSCSc@gmail.com"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border hover:border-primary/50 transition-colors"
            >
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">ieee.sscs@example.com</span>
            </a>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Vellore Institute of Technology, Chennai</span>
            </div>
          </motion.div>

          {/* Social Links */}
          <motion.div
            className="flex justify-center gap-3 mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:text-primary transition-colors"
                aria-label={social.label}
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <motion.footer
          className="border-t border-border pt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="https://bqtqhtpbyunzcwxyxdhx.supabase.co/storage/v1/object/public/asset/IEEE%20SSCS%20Logo.png" alt="IEEE SSCS" className="w-8 h-8 object-contain" />
              <span className="font-heading font-bold text-sm">
                <span className="text-primary">IEEE</span>
                <span className="text-foreground"> SSCS</span>
              </span>
            </div>

            <p className="text-xs text-muted-foreground text-center font-mono">
              <span className="inline-flex items-center gap-1.5 mx-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                SYSTEM: ONLINE
              </span>
              | © 2026 IEEE SSCS
            </p>

            <p className="text-xs text-muted-foreground">
              Design • Fabricate • Test
            </p>
          </div>
        </motion.footer>
      </div>
    </section>
  );
};

export default ContactSection;
