import { motion } from 'framer-motion';
import { GraduationCap, ArrowLeft, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import TechGridBackground from '@/components/ui/TechGridBackground';

const coordinators = [
  {
    name: 'Sangeetha R G',
    role: 'Faculty Coordinator',
    image: '/sangeetha.png',
    description: 'Expert mentorship in technical direction and academic excellence for IEEE SSCS.'
  },
  {
    name: 'Hemanth C',
    role: 'Faculty Coordinator',
    image: '/hemanth.png',
    description: 'Guiding innovation and student engagement within the solid-state circuits domain.'
  }
];

const coreTeam = [
  {
    name: 'E Abijay',
    role: 'Chairperson',
    image: '/abijay.png',
    quote: 'Never Settle!'
  },
  {
    name: 'Kiran Kumar',
    role: 'Vice Chairperson',
    image: '/kiran.png',
    quote: 'I create systems that redefine the best.'
  },
  {
    name: 'Manasa Grandhi',
    role: 'General Secretary',
    image: '/manasa.png',
    quote: 'Troubles are just passing clouds.'
  },
  {
    name: 'Mrithubashini',
    role: 'General Secretary',
    image: '/mrithubashini.png',
    quote: "Let's see what happens."
  },
  {
    name: 'Arushi',
    role: 'Treasurer',
    image: '/arushi.png',
    quote: 'Who wishes to fight must first count the cost.'
  }
];

const leads = [
  {
    name: 'Shivaranjani',
    role: 'Technical Lead',
    image: '/shivaranjani.png',
    quote: "Life's a circuit—I'm still meeting setup and hold."
  },
  {
    name: 'Harshan',
    role: 'Technical Lead',
    image: '/harshan.png',
    quote: 'Observe. Plan. Execute.'
  },
  {
    name: 'Ilangkumaran',
    role: 'Operations Lead',
    image: '/ilangkumaran.png',
    quote: "Big ideas don't need noise, they need action."
  },
  {
    name: 'Sibhi S',
    role: 'Operations Lead',
    image: '/sibhi.png',
    quote: 'Anbe Sivam'
  },
  {
    name: 'Neyalakshmi',
    role: 'Editorial Lead',
    image: '/neya.png',
    quote: 'PEACE!'
  },
  {
    name: 'Goutham P',
    role: 'Editorial Lead',
    image: '/goutham.png',
    quote: 'SKY IS THE LIMIT'
  },
  {
    name: 'Priyadharshini',
    role: 'Design Lead',
    image: '/priyadharshini.png',
    quote: 'LOST IN A PASTEL SKY'
  },
  {
    name: 'Midhun P',
    role: 'Associate Design Lead',
    image: '/midhun.png',
    quote: 'COOL TONE WARM CORE'
  }
];

const Team = () => {
    return (
        <div className="min-h-screen relative text-foreground bg-[#050505] overflow-hidden">
            <TechGridBackground />
            
            {/* Background Ornaments */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
            </div>

            <div className="container mx-auto px-6 py-12 relative z-10">
                {/* Unified Width Container */}
                <div className="max-w-6xl mx-auto">
                    <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-12 px-6 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-sm">
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        Back to Home
                    </Link>

                    <div className="text-center mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4"
                        >
                            <span className="text-[10px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                                Leadership
                            </span>
                        </motion.div>
                        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
                            <RevealText text="Faculty Coordinators" />
                        </h1>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {coordinators.map((coord, index) => (
                            <motion.div
                                key={coord.name}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <HolographicCard className="p-8 text-center h-full">
                                    <div className="flex flex-col items-center">
                                        <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary relative overflow-hidden border border-primary/20">
                                            <img 
                                                src={coord.image} 
                                                alt={coord.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                        </div>

                                        <div className="mb-4">
                                            <span className="inline-block text-[10px] text-primary font-bold tracking-[0.3em] uppercase mb-2 px-4 py-1 rounded-full bg-primary/10 border border-primary/20">
                                                {coord.role}
                                            </span>
                                            <h2 className="font-heading text-2xl md:text-3xl font-bold text-white mb-4">
                                                {coord.name}
                                            </h2>
                                        </div>

                                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                                            {coord.description}
                                        </p>
                                    </div>
                                </HolographicCard>
                            </motion.div>
                        ))}
                    </div>

                    {/* Core Team Section */}
                    <div className="text-center mt-24 mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="mb-4"
                        >
                            <span className="text-[10px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                                Leadership
                            </span>
                        </motion.div>
                        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
                            <RevealText text="Core Team" />
                        </h1>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 mb-24">
                        {coreTeam.map((member, index) => (
                            <motion.div
                                key={member.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)]"
                            >
                                <HolographicCard className="p-6 text-center h-full flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-2xl bg-white/5 grid place-items-center mb-6 relative overflow-hidden border border-white/10 group-hover:border-primary/30 transition-colors">
                                        <img 
                                            src={member.image} 
                                            alt={member.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>

                                    <div className="mb-4 flex-1">
                                        <span className="inline-block text-[10px] text-primary font-bold tracking-[0.2em] uppercase mb-2">
                                            {member.role}
                                        </span>
                                        <h2 className="font-heading text-xl font-bold text-white mb-3">
                                            {member.name}
                                        </h2>
                                        <p className="text-xs italic text-muted-foreground leading-relaxed">
                                            "{member.quote}"
                                        </p>
                                    </div>
                                </HolographicCard>
                            </motion.div>
                        ))}
                    </div>

                    {/* Leads Section */}
                    <div className="text-center mt-24 mb-16">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="mb-4"
                        >
                            <span className="text-[10px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                                Expertise
                            </span>
                        </motion.div>
                        <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
                            <RevealText text="Leads" />
                        </h1>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 mb-24">
                        {leads.map((member, index) => (
                            <motion.div
                                key={member.name}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)]"
                            >
                                <HolographicCard className="p-6 text-center h-full flex flex-col items-center">
                                    <div className="w-20 h-20 rounded-2xl bg-white/5 grid place-items-center mb-6 relative overflow-hidden border border-white/10 group-hover:border-primary/30 transition-colors">
                                        <img 
                                            src={member.image} 
                                            alt={member.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>

                                    <div className="mb-4 flex-1">
                                        <span className="inline-block text-[10px] text-primary font-bold tracking-[0.2em] uppercase mb-2">
                                            {member.role}
                                        </span>
                                        <h2 className="font-heading text-lg font-bold text-white mb-3">
                                            {member.name}
                                        </h2>
                                        <p className="text-xs italic text-muted-foreground leading-relaxed">
                                            "{member.quote}"
                                        </p>
                                    </div>
                                </HolographicCard>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Team;
