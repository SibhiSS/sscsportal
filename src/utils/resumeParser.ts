/**
 * Resume Parser — client-side regex extraction
 * Extracts skills, GitHub, LinkedIn, portfolio URLs from free-text fields
 */

// ── Skill detection patterns ─────────────────────────────────────────────────
const SKILL_PATTERNS: Record<string, RegExp> = {
    // Languages
    Python: /\bpython\b/i,
    JavaScript: /\bjavascript\b|\bjs\b/i,
    TypeScript: /\btypescript\b|\bts\b/i,
    'C++': /\bc\+\+\b|cpp/i,
    'C': /\b(?<!\w)c(?!\+\+|\w)\b/,
    Java: /\bjava\b(?!script)/i,
    Rust: /\brust\b/i,
    Go: /\bgolang\b|\b(?<!\w)go(?!\w)/i,
    Kotlin: /\bkotlin\b/i,
    Swift: /\bswift\b/i,
    // Web
    React: /\breact(?:\.js)?\b/i,
    'Next.js': /\bnext\.?js\b/i,
    'Vue.js': /\bvue(?:\.js)?\b/i,
    Angular: /\bangular\b/i,
    HTML: /\bhtml\b/i,
    CSS: /\bcss\b/i,
    'Tailwind CSS': /\btailwind\b/i,
    Node: /\bnode(?:\.js)?\b/i,
    Express: /\bexpress(?:\.js)?\b/i,
    // Backend / DB
    PostgreSQL: /\bpostgres(?:ql)?\b/i,
    MySQL: /\bmysql\b/i,
    MongoDB: /\bmongodb\b|\bmongo\b/i,
    Firebase: /\bfirebase\b/i,
    Supabase: /\bsupabase\b/i,
    // ML/AI
    'Machine Learning': /\bml\b|\bmachine\s?learning\b/i,
    'Deep Learning': /\bdeep\s?learning\b/i,
    TensorFlow: /\btensorflow\b/i,
    PyTorch: /\bpytorch\b/i,
    // Design
    Figma: /\bfigma\b/i,
    'Adobe XD': /\badobe\s?xd\b/i,
    Photoshop: /\bphotoshop\b/i,
    Illustrator: /\billustrator\b/i,
    // Embedded / Hardware
    Arduino: /\barduino\b/i,
    'STM32': /\bstm32\b/i,
    'Embedded Systems': /\bembedded\b/i,
    VHDL: /\bvhdl\b/i,
    Verilog: /\bverilog\b/i,
    // Tools
    Git: /\bgit\b/i,
    Docker: /\bdocker\b/i,
    Linux: /\blinux\b/i,
    AWS: /\baws\b/i,
    Flutter: /\bflutter\b/i,
    'React Native': /\breact\s?native\b/i,
    // Soft skills (optional, for Operations/Content)
    Leadership: /\bleadership\b/i,
    'Public Speaking': /\bpublic\s?speaking\b/i,
    Writing: /\bwriting\b|\bcopywriting\b/i,
    Editing: /\bediting\b/i,
    Photography: /\bphotography\b/i,
};

// ── URL extractors ──────────────────────────────────────────────────────────

export function extractGithub(text: string): string | null {
    const match = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/?/i);
    return match ? `https://github.com/${match[1]}` : null;
}

export function extractLinkedIn(text: string): string | null {
    const match = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/i);
    return match ? `https://linkedin.com/in/${match[1]}` : null;
}

export function extractPortfolio(text: string): string | null {
    // Match any URL that isn't github or linkedin
    const match = text.match(/https?:\/\/(?!(?:www\.)?(?:github|linkedin))[\w.-]+\.[a-z]{2,}[^\s]*/i);
    return match ? match[0] : null;
}

// ── Skill tag extractor ────────────────────────────────────────────────────

export function extractSkillTags(text: string): string[] {
    if (!text) return [];
    const found: string[] = [];
    for (const [skill, pattern] of Object.entries(SKILL_PATTERNS)) {
        if (pattern.test(text)) {
            found.push(skill);
        }
    }
    return found;
}

// ── Combined parser for a full application ───────────────────────────────────

export interface ParsedResumeData {
    skills: string[];
    githubUrl: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
}

export function parseApplicationText(skillsText: string, reasonText: string = ''): ParsedResumeData {
    const combined = `${skillsText} ${reasonText}`;
    return {
        skills: extractSkillTags(combined),
        githubUrl: extractGithub(combined),
        linkedinUrl: extractLinkedIn(combined),
        portfolioUrl: extractPortfolio(combined),
    };
}

// ── Skill frequency analysis (for analytics heatmap) ─────────────────────────

export interface SkillFreq {
    skill: string;
    count: number;
    percentage: number;
    category: 'language' | 'web' | 'design' | 'embedded' | 'ml' | 'tools' | 'soft';
}

const SKILL_CATEGORIES: Record<string, SkillFreq['category']> = {
    Python: 'language', JavaScript: 'language', TypeScript: 'language',
    'C++': 'language', 'C': 'language', Java: 'language', Rust: 'language',
    Go: 'language', Kotlin: 'language', Swift: 'language',
    React: 'web', 'Next.js': 'web', 'Vue.js': 'web', Angular: 'web',
    HTML: 'web', CSS: 'web', 'Tailwind CSS': 'web', Node: 'web', Express: 'web',
    Figma: 'design', 'Adobe XD': 'design', Photoshop: 'design', Illustrator: 'design',
    Arduino: 'embedded', STM32: 'embedded', 'Embedded Systems': 'embedded',
    VHDL: 'embedded', Verilog: 'embedded',
    'Machine Learning': 'ml', 'Deep Learning': 'ml', TensorFlow: 'ml', PyTorch: 'ml',
    Git: 'tools', Docker: 'tools', Linux: 'tools', AWS: 'tools',
    Flutter: 'tools', 'React Native': 'tools',
    Leadership: 'soft', 'Public Speaking': 'soft', Writing: 'soft',
    Editing: 'soft', Photography: 'soft',
};

export function computeSkillFrequencies(applications: { skills?: string; reason?: string }[]): SkillFreq[] {
    const counts: Record<string, number> = {};
    const total = applications.length || 1;

    for (const app of applications) {
        const combined = `${app.skills || ''} ${app.reason || ''}`;
        const found = extractSkillTags(combined);
        for (const skill of found) {
            counts[skill] = (counts[skill] || 0) + 1;
        }
    }

    return Object.entries(counts)
        .map(([skill, count]) => ({
            skill,
            count,
            percentage: Math.round((count / total) * 100),
            category: SKILL_CATEGORIES[skill] ?? 'tools',
        }))
        .sort((a, b) => b.count - a.count);
}
