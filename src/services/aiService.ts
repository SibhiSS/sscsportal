import { Application, AIAnalysisResult, AppSettings } from '@/types';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Competency Rubrics for IEEE SSCS Domains
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
    'Analog IC Design': [
        'cadence', 'virtuoso', 'opamp', 'op-amp', 'cmos', 'vlsi', 'layout', 'spice', 
        'circuit', 'mosfet', 'amplifier', 'adc', 'dac', 'pll', 'rfic', 'analog', 
        'tsmc', 'transistor', 'analog design', 'circuit design', 'bandgap', 'ltspice'
    ],
    'Digital IC / FPGA': [
        'verilog', 'vhdl', 'systemverilog', 'fpga', 'rtl', 'vivado', 'quartus', 
        'model', 'digital design', 'state machine', 'fsm', 'risc-v', 'riscv', 
        'asic', 'synthesis', 'simulation', 'modelsim', 'verilator', 'timing analysis', 'computer architecture'
    ],
    'Embedded Systems / IoT': [
        'microcontroller', 'arduino', 'stm32', 'esp32', 'raspberry pi', 'embedded c', 
        'c++', 'iot', 'pcb', 'kicad', 'altium', 'eagle', 'sensor', 'uart', 'spi', 
        'i2c', 'can bus', 'rtos', 'firmware', 'hardware', 'robotics', 'arm', 'pic'
    ],
    'AI / ML & Signal Processing': [
        'python', 'pytorch', 'tensorflow', 'keras', 'scikit-learn', 'machine learning', 
        'deep learning', 'neural network', 'cnn', 'rnn', 'nlp', 'computer vision', 
        'opencv', 'data analysis', 'numpy', 'pandas', 'matlab', 'signal processing', 'dsp', 'ai'
    ],
    'Web Dev & Software': [
        'react', 'next.js', 'vue', 'angular', 'typescript', 'javascript', 'html', 
        'css', 'tailwind', 'node.js', 'express', 'python', 'django', 'flask', 
        'fastapi', 'database', 'sql', 'postgres', 'mongodb', 'git', 'github', 'docker', 'api', 'fullstack', 'frontend', 'backend', 'web'
    ],
    'Management & Finance': [
        'leadership', 'management', 'event', 'organize', 'teamwork', 'communication', 
        'budget', 'finance', 'sponsorship', 'marketing', 'social media', 'content', 
        'canva', 'figma', 'ui/ux', 'public speaking', 'project management', 'agile', 'scrum', 'logistics'
    ]
};

// Helper to normalize department name to domain key
function getDomainKey(deptName: string): string {
    const lower = (deptName || '').toLowerCase();
    if (lower.includes('analog') || lower.includes('vlsi') || lower.includes('circuit')) return 'Analog IC Design';
    if (lower.includes('digital') || lower.includes('fpga') || lower.includes('rtl')) return 'Digital IC / FPGA';
    if (lower.includes('embedded') || lower.includes('iot') || lower.includes('hardware') || lower.includes('pcb') || lower.includes('robot')) return 'Embedded Systems / IoT';
    if (lower.includes('ai') || lower.includes('ml') || lower.includes('signal') || lower.includes('data')) return 'AI / ML & Signal Processing';
    if (lower.includes('web') || lower.includes('app') || lower.includes('software') || lower.includes('dev') || lower.includes('tech')) return 'Web Dev & Software';
    return 'Management & Finance';
}

// Helper to capitalize strings nicely for badges
function formatTag(str: string): string {
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Local Semantic NLP Engine
// ─────────────────────────────────────────────────────────────────────────────

function runLocalAnalysis(application: Application): AIAnalysisResult {
    const primaryDept = application.primaryDept || application.department || 'General';
    const domainKey = getDomainKey(primaryDept);
    const expectedKeywords = DOMAIN_KEYWORDS[domainKey] || DOMAIN_KEYWORDS['Management & Finance'];

    // Combine candidate text corpus
    const corpus = `${application.skills || ''} ${application.reason || ''} ${application.domains?.join(' ') || ''} ${application.secondarySkills || ''}`.toLowerCase();

    // Find keyword matches
    const matchedKeywords = expectedKeywords.filter(kw => {
        // Match exact word or substring with boundary check
        const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        return regex.test(corpus) || corpus.includes(kw);
    });

    // Compute Match Score (0 - 100%)
    let matchScore = 55; // Base qualification score
    matchScore += Math.min(matchedKeywords.length * 8, 35); // Up to +35% for keyword depth
    if (application.githubUrl || application.portfolioUrl || application.linkedinUrl) {
        matchScore += 5; // +5% for external portfolio validation
    }
    if ((application.reason || '').length > 100) {
        matchScore += 3; // +3% for detailed motivation
    }
    matchScore = Math.min(Math.max(matchScore, 48), 98); // Clamp between 48% and 98%

    // Formulate 3 Executive Summary Bullets
    const deptDisplay = application.programName || application.department || 'Engineering';
    const yearDisplay = application.batch ? `Batch ${application.batch}` : `Year ${application.admissionYear || application.year || '1'}`;
    const bullet1 = `Candidate from ${deptDisplay} (${yearDisplay}) targeting **${primaryDept}** as primary preference${application.secondaryDept ? ` and **${application.secondaryDept}** as secondary` : ''}.`;
    
    let bullet2 = matchedKeywords.length > 0
        ? `Demonstrates technical familiarity with **${matchedKeywords.slice(0, 4).map(formatTag).join(', ')}** relevant to ${domainKey}.`
        : `Enthusiastic applicant expressing strong foundational interest in ${domainKey} with eagerness for technical mentorship.`;
    
    const reasonClean = (application.reason || '').replace(/\s+/g, ' ').trim();
    const reasonSnippet = reasonClean.length > 110 ? `${reasonClean.slice(0, 110)}...` : reasonClean || 'Active participation and contribution to IEEE SSCS projects.';
    const bullet3 = `Motivation & Alignment: "${reasonSnippet}"`;

    const summaryBullets = [bullet1, bullet2, bullet3];

    // Formulate Strengths
    const strengths: string[] = matchedKeywords.slice(0, 5).map(formatTag);
    if (application.githubUrl) strengths.push('Active GitHub Profile');
    if (application.portfolioUrl) strengths.push('External Portfolio Link');
    if (application.domains && application.domains.length >= 2) strengths.push('Multi-Domain Interest');
    if (strengths.length === 0) strengths.push('High Enthusiasm & Eagerness to Learn');

    // Formulate Gaps
    const gaps: string[] = [];
    if (matchedKeywords.length < 2) {
        gaps.push(`Limited explicit mentions of ${domainKey} core tools in application`);
    }
    if (!application.githubUrl && !application.portfolioUrl && domainKey !== 'Management & Finance') {
        gaps.push('No GitHub or technical project repository linked');
    }
    if ((application.skills || '').length < 40) {
        gaps.push('Brief description of technical skills and past projects');
    }
    if (gaps.length === 0) {
        gaps.push('No major qualification gaps identified from resume text');
    }

    // Executive Recommendation
    let recommendation = '';
    if (matchScore >= 80) {
        recommendation = `Strong technical alignment with ${primaryDept}; recommend focusing interview on advanced practical implementations and team leadership fit.`;
    } else if (matchScore >= 65) {
        recommendation = `Solid potential for ${primaryDept}; verify hands-on understanding of key domain concepts and problem-solving fundamentals during panel review.`;
    } else {
        recommendation = `Entry-level candidate for ${primaryDept}; assess foundational learning aptitude, dedication, and openness to committee training programs.`;
    }

    return {
        matchScore,
        summaryBullets,
        strengths: Array.from(new Set(strengths)).slice(0, 6),
        gaps: Array.from(new Set(gaps)).slice(0, 4),
        recommendation,
        mode: 'local'
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud LLM Integration (Gemini / OpenAI Optional Fallback)
// ─────────────────────────────────────────────────────────────────────────────

async function runCloudLLMAnalysis(application: Application, provider: 'gemini' | 'openai', apiKey: string): Promise<AIAnalysisResult> {
    const prompt = `You are an AI Recruitment Copilot for IEEE Solid-State Circuits Society (SSCS). Analyze the following candidate application for our technical committee recruitment:
Applicant Name: ${application.fullName}
Academic Profile: ${application.programName || application.department} (Year/Batch: ${application.batch || application.year})
Primary Department Choice: ${application.primaryDept}
Domains of Interest: ${application.domains?.join(', ') || 'N/A'}
Skills / Experience (Primary Dept): ${application.skills || 'N/A'}
Why Join IEEE SSCS?: ${application.reason || 'N/A'}
Secondary Department Choice: ${application.secondaryDept || 'None'}
Secondary Skills / Experience: ${application.secondarySkills || 'N/A'}
Links: GitHub=${application.githubUrl || 'None'}, LinkedIn=${application.linkedinUrl || 'None'}, Portfolio=${application.portfolioUrl || 'None'}

Return ONLY a valid JSON object with the following schema (no markdown formatting, no code blocks, just raw JSON):
{
  "matchScore": number between 45 and 99 indicating percentage qualification fit for ${application.primaryDept},
  "summaryBullets": [3 concise executive bullet points summarizing candidate profile, technical qualifications, and motivation],
  "strengths": [array of 3 to 5 key matching technical competency tags or strengths],
  "gaps": [array of 1 to 3 potential gaps or areas to probe during interview],
  "recommendation": "1-sentence executive recommendation for the interview panel"
}`;

    if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
            })
        });
        if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty response from Gemini");
        const parsed = JSON.parse(text);
        return {
            matchScore: Math.round(Number(parsed.matchScore) || 75),
            summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.slice(0, 3) : runLocalAnalysis(application).summaryBullets,
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6) : ['Cloud AI Verified'],
            gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 4) : ['None noted'],
            recommendation: parsed.recommendation || 'Verified candidate profile.',
            mode: 'gemini'
        };
    } else {
        // OpenAI
        const url = `https://api.openai.com/v1/chat/completions`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                response_format: { type: "json_object" }
            })
        });
        if (!response.ok) throw new Error(`OpenAI API Error: ${response.status}`);
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error("Empty response from OpenAI");
        const parsed = JSON.parse(text);
        return {
            matchScore: Math.round(Number(parsed.matchScore) || 75),
            summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.slice(0, 3) : runLocalAnalysis(application).summaryBullets,
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6) : ['Cloud AI Verified'],
            gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 4) : ['None noted'],
            recommendation: parsed.recommendation || 'Verified candidate profile.',
            mode: 'openai'
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Exported Service
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeCandidate(application: Application): Promise<AIAnalysisResult> {
    try {
        // AI settings live in their own 'ai_settings' row, NOT in 'recruitment_status'.
        // The latter is world-readable (app_settings_select_public) because the apply
        // form needs it, so an API key stored there is public. 'ai_settings' is gated
        // behind app_settings_select_admin; non-admins get null and fall back to local.
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'ai_settings').maybeSingle();
        const aiSettings: AppSettings['aiSettings'] | undefined = data?.value;

        const provider = aiSettings?.provider;
        const apiKey = aiSettings?.apiKey ||
            (provider === 'gemini' ? import.meta.env.VITE_GEMINI_API_KEY : import.meta.env.VITE_OPENAI_API_KEY);

        if (provider && (provider === 'gemini' || provider === 'openai') && apiKey) {
            try {
                return await runCloudLLMAnalysis(application, provider, apiKey);
            } catch (cloudError) {
                console.warn(`[AI Copilot] Cloud LLM (${provider}) failed or rate-limited. Falling back to Local NLP Engine:`, cloudError);
                return runLocalAnalysis(application);
            }
        }
    } catch (dbError) {
        console.warn("[AI Copilot] Could not check app_settings for AI provider, defaulting to Local NLP Engine.", dbError);
    }

    // Default 100% reliable out-of-the-box Local Semantic NLP analysis
    return runLocalAnalysis(application);
}
