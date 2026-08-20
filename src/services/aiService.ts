import { Application, AIAnalysisResult, AppSettings } from '@/types';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Competency Rubrics for IEEE SSCS Domains — passed into the LLM prompt as
// reference vocabulary so scoring stays grounded in this chapter's actual
// sub-teams instead of generic "resume screening."
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

// Signals of genuine IEEE community involvement, surfaced to the LLM as things to
// specifically look for — independent of whichever DOMAIN_KEYWORDS list applies.
const IEEE_INVOLVEMENT_KEYWORDS: string[] = [
    'ieee', 'sscs', 'solid-state circuits', 'solid state circuits', 'ieee student member',
    'ieee membership', 'student branch', 'technical paper', 'research paper', 'publication',
    'ieee day', 'ieee event', 'workshop', 'symposium', 'conference', 'hackathon'
];

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

// ECE/EEE are the core academic branches for an SSCS chapter; surfaced to the LLM
// so it can give a modest, explicit scoring boost without penalizing strong
// candidates from other branches.
function isCoreEceEeeBranch(dept: string): boolean {
    const lower = (dept || '').toLowerCase();
    return (
        /\bece\b/.test(lower) || /\beee\b/.test(lower) ||
        lower.includes('electronics and communication') ||
        lower.includes('electronics & communication') ||
        lower.includes('electrical and electronics') ||
        lower.includes('electrical & electronics') ||
        lower.includes('electronics engineering') ||
        lower.includes('electrical engineering')
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloud LLM Integration (Gemini primary / OpenAI alternative — no local fallback)
// ─────────────────────────────────────────────────────────────────────────────

// Best-available Gemini model first, falling back to the stable model only if the
// preview model errors out (e.g. not yet enabled on a given API key).
const GEMINI_MODELS = ['gemini-3-pro-preview', 'gemini-2.5-flash'] as const;

function buildPrompt(application: Application): string {
    const primaryDept = application.primaryDept || application.department || 'General';
    const domainKey = getDomainKey(primaryDept);
    const referenceKeywords = (DOMAIN_KEYWORDS[domainKey] || []).join(', ');
    const academicBranch = application.programName || application.department || 'Unknown';
    const coreBranch = isCoreEceEeeBranch(academicBranch);

    return `You are an AI Recruitment Copilot for the IEEE Solid-State Circuits Society (SSCS) student chapter. Analyze the following candidate application for technical committee recruitment.

Chapter scoring priorities for this recruitment cycle — apply these explicitly:
1. Give a meaningful matchScore boost to candidates whose academic branch is ECE (Electronics & Communication Engineering) or EEE (Electrical & Electronics Engineering) — these are the core technical fit for an SSCS chapter. This candidate's academic branch is "${academicBranch}", which is${coreBranch ? '' : ' NOT'} a core ECE/EEE branch by pattern match — use your own judgment too, since department names vary.
2. Give a meaningful matchScore boost for demonstrated IEEE involvement: IEEE student membership, having attended/volunteered at IEEE events, technical papers/publications, workshops, symposiums, or hackathons. Look for signals like: ${IEEE_INVOLVEMENT_KEYWORDS.join(', ')}.
3. Candidates from other branches (CSE, IT, Mech, etc.) with genuinely strong hands-on technical skills relevant to their chosen department should still score well — do not penalize them purely for branch — but an ECE/EEE candidate with comparable technical skill signals should generally score a few points higher.
4. Reference vocabulary for the "${primaryDept}" (${domainKey}) sub-team, to ground your technical assessment: ${referenceKeywords}.
5. When branch alignment or IEEE involvement materially affected the score, say so explicitly in summaryBullets or strengths.

Applicant Name: ${application.fullName}
Academic Branch: ${academicBranch} (Year/Batch: ${application.batch || application.year})
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
}

function parseLLMJson(text: string, mode: 'gemini' | 'openai'): AIAnalysisResult {
    const parsed = JSON.parse(text);
    return {
        matchScore: Math.round(Number(parsed.matchScore) || 75),
        summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.slice(0, 3) : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6) : ['Cloud AI Verified'],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 4) : ['None noted'],
        recommendation: parsed.recommendation || 'Verified candidate profile.',
        mode
    };
}

async function runGeminiAnalysis(prompt: string, apiKey: string): Promise<AIAnalysisResult> {
    let lastError: unknown;
    for (const model of GEMINI_MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
                })
            });
            if (!response.ok) throw new Error(`Gemini API error on ${model}: ${response.status}`);
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error(`Empty response from Gemini (${model})`);
            return parseLLMJson(text, 'gemini');
        } catch (err) {
            lastError = err;
            console.warn(`[AI Copilot] Gemini model "${model}" failed, trying next fallback if available.`, err);
        }
    }
    throw lastError instanceof Error ? lastError : new Error('All Gemini models failed');
}

async function runOpenAIAnalysis(prompt: string, apiKey: string): Promise<AIAnalysisResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            response_format: { type: 'json_object' }
        })
    });
    if (!response.ok) throw new Error(`OpenAI API Error: ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenAI');
    return parseLLMJson(text, 'openai');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Exported Service
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeCandidate(application: Application): Promise<AIAnalysisResult> {
    // AI settings live in their own 'ai_settings' row, NOT in 'recruitment_status'.
    // The latter is world-readable (app_settings_select_public) because the apply
    // form needs it, so an API key stored there is public. 'ai_settings' is gated
    // behind app_settings_select_admin; non-admins get null.
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'ai_settings').maybeSingle();
    const aiSettings: AppSettings['aiSettings'] | undefined = data?.value;

    const provider = aiSettings?.provider;
    const apiKey = aiSettings?.apiKey ||
        (provider === 'gemini' ? import.meta.env.VITE_GEMINI_API_KEY : import.meta.env.VITE_OPENAI_API_KEY);

    if (!provider || (provider !== 'gemini' && provider !== 'openai') || !apiKey) {
        throw new Error('AI Copilot is not configured. Add a Gemini (or OpenAI) API key under Admin → System Configuration → AI Copilot.');
    }

    const prompt = buildPrompt(application);
    return provider === 'gemini' ? runGeminiAnalysis(prompt, apiKey) : runOpenAIAnalysis(prompt, apiKey);
}
