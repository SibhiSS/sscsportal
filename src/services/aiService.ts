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
// Cloud LLM Integration — Gemini and OpenAI, each usable as the other's
// automatic fallback when both keys are configured (see resolveKeys below).
// ─────────────────────────────────────────────────────────────────────────────

// Google retires/renames model IDs over time — 'gemini-3-pro-preview' and
// 'gemini-2.5-flash' both went dead (HTTP 404 "no longer available to new
// users"). 'gemini-3.6-flash' is the current replacement per Google's own
// error response. Keep this list to models actually confirmed live — every
// dead entry tried before the working one still counts as a failed request
// against the key's quota.
const GEMINI_MODELS = ['gemini-3.6-flash'] as const;

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

Scoring the person, not just the resume — score TWO separate sub-dimensions, then blend them:
6. "technicalScore" (0-100): pure technical/domain competency — tools, depth, relevant experience, project complexity, alignment with the reference vocabulary above.
7. "engagementScore" (0-100): creativity, initiative/activeness, and eagerness genuinely shown in HOW they answered — specific stories, self-directed projects, evidence of doing things beyond what was asked, enthusiasm that reads as real rather than a template. Weight this dimension MORE heavily than raw technical keyword matching when computing the final matchScore — a candidate who shows real creative initiative and hunger to contribute should generally outscore an equally-technical candidate who gave flat, generic answers.
8. Do NOT let a high engagementScore fully substitute for technical competency on a technical sub-team, and do NOT let a low engagementScore tank a genuinely excellent technical candidate — highly technical people should still score well even if their writing style is terse or matter-of-fact. Blend roughly: matchScore ≈ 0.45 × engagementScore + 0.40 × technicalScore + 0.15 × (branch/IEEE bonus described above), then clamp to the 45-99 range — use this as guidance, not a rigid formula.

Content-authenticity check (a review flag for the human admin, NOT an auto-reject):
9. Assess "aiGeneratedLikelihood" (0-100): how likely it is that the "Skills / Experience" and "Why Join" answers were generated or heavily rewritten by an AI chatbot rather than written personally — look for generic/templated phrasing, overly polished corporate tone mismatched with a student applicant, listy "I am passionate about X, Y, and Z" structures, or lack of any specific concrete detail. A low score means the writing reads as authentic and personal (even if simple or imperfect) — imperfect, specific, personal writing should score LOW here, not high. Give a 1-sentence "aiGeneratedNotes" justification. This must never by itself lower matchScore — it's a separate flag for manual review, since even a great technical candidate might use AI to polish grammar.

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
  "matchScore": number between 45 and 99 indicating overall percentage qualification fit for ${application.primaryDept},
  "technicalScore": number 0-100,
  "engagementScore": number 0-100,
  "aiGeneratedLikelihood": number 0-100,
  "aiGeneratedNotes": "1-sentence justification for the aiGeneratedLikelihood value",
  "summaryBullets": [3 concise executive bullet points summarizing candidate profile, technical qualifications, and motivation],
  "strengths": [array of 3 to 5 key matching technical competency tags or strengths],
  "gaps": [array of 1 to 3 potential gaps or areas to probe during interview],
  "recommendation": "1-sentence executive recommendation for the interview panel"
}`;
}

function parseLLMJson(text: string, mode: 'gemini' | 'openai'): AIAnalysisResult {
    // Models sometimes wrap JSON in ```json fences despite instructions — strip them.
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    const clamp = (n: unknown, fallback: number) => {
        const num = Number(n);
        return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : fallback;
    };
    return {
        matchScore: Math.max(45, Math.min(99, clamp(parsed.matchScore, 75))),
        summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.slice(0, 3) : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6) : ['Cloud AI Verified'],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 4) : ['None noted'],
        recommendation: parsed.recommendation || 'Verified candidate profile.',
        technicalScore: clamp(parsed.technicalScore, 70),
        engagementScore: clamp(parsed.engagementScore, 70),
        aiGeneratedLikelihood: clamp(parsed.aiGeneratedLikelihood, 0),
        aiGeneratedNotes: parsed.aiGeneratedNotes || 'No concerns noted.',
        mode
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error handling — surfaces WHY a call failed (quota vs rate-limit vs bad key)
// instead of a bare status code, and retries transient failures with backoff.
// ─────────────────────────────────────────────────────────────────────────────

class ProviderError extends Error {
    constructor(message: string, public status: number, public retryable: boolean) {
        super(message);
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function describeErrorResponse(provider: 'Gemini' | 'OpenAI', response: Response): Promise<ProviderError> {
    let bodyText = '';
    try { bodyText = await response.text(); } catch { /* ignore */ }
    let apiMessage = '';
    let apiCode = '';
    try {
        const body = JSON.parse(bodyText);
        apiMessage = body?.error?.message || body?.error?.status || '';
        apiCode = body?.error?.code || body?.error?.type || body?.error?.status || '';
    } catch { /* body wasn't JSON */ }

    if (response.status === 429) {
        const isQuota = /quota|insufficient_quota|billing/i.test(apiCode + apiMessage);
        const detail = isQuota
            ? `${provider} quota exhausted — the API key's plan/billing limit has been used up. Check usage & billing on the ${provider} developer console, or switch to a different provider/key.`
            : `${provider} is rate-limiting requests (HTTP 429). This is usually transient — it will retry automatically, but if it keeps happening the key's requests-per-minute limit is too low for this traffic.`;
        return new ProviderError(detail + (apiMessage ? ` (${apiMessage})` : ''), 429, !isQuota);
    }
    if (response.status === 401 || response.status === 403) {
        return new ProviderError(`${provider} rejected the API key (HTTP ${response.status}). Double-check the key under Admin → Settings → AI Copilot.${apiMessage ? ` (${apiMessage})` : ''}`, response.status, false);
    }
    if (response.status >= 500) {
        return new ProviderError(`${provider} is temporarily unavailable (HTTP ${response.status}).${apiMessage ? ` (${apiMessage})` : ''}`, response.status, true);
    }
    return new ProviderError(`${provider} API error (HTTP ${response.status}).${apiMessage ? ` ${apiMessage}` : ''}`, response.status, false);
}

async function fetchWithRetry(provider: 'Gemini' | 'OpenAI', doFetch: () => Promise<Response>, maxRetries = 2): Promise<Response> {
    let attempt = 0;
    for (; ;) {
        const response = await doFetch();
        if (response.ok) return response;

        const error = await describeErrorResponse(provider, response);
        if (!error.retryable || attempt >= maxRetries) throw error;

        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
        const backoffMs = Number.isFinite(retryAfterMs) ? retryAfterMs : 800 * Math.pow(2, attempt);
        console.warn(`[AI Copilot] ${provider} call failed (retryable), waiting ${backoffMs}ms before retry ${attempt + 1}/${maxRetries}.`, error.message);
        await sleep(backoffMs);
        attempt++;
    }
}

// Raw text call, one per provider — shared by the resume-fit analysis
// (parseLLMJson) and the committee-fit analysis (parseCommitteeFitJson) below,
// which need the same HTTP/retry/model-fallback plumbing but parse a different
// response shape.
async function callGeminiRaw(prompt: string, apiKey: string): Promise<string> {
    let lastError: unknown;
    for (const model of GEMINI_MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetchWithRetry('Gemini', () => fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
                })
            }));
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error(`Empty response from Gemini (${model})`);
            return text;
        } catch (err) {
            lastError = err;
            console.warn(`[AI Copilot] Gemini model "${model}" failed, trying next fallback if available.`, err);
        }
    }
    throw lastError instanceof Error ? lastError : new Error('All Gemini models failed');
}

async function callOpenAIRaw(prompt: string, apiKey: string): Promise<string> {
    const response = await fetchWithRetry('OpenAI', () => fetch('https://api.openai.com/v1/chat/completions', {
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
    }));
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenAI');
    return text;
}

async function runGeminiAnalysis(prompt: string, apiKey: string): Promise<AIAnalysisResult> {
    return parseLLMJson(await callGeminiRaw(prompt, apiKey), 'gemini');
}

async function runOpenAIAnalysis(prompt: string, apiKey: string): Promise<AIAnalysisResult> {
    return parseLLMJson(await callOpenAIRaw(prompt, apiKey), 'openai');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Exported Service
// ─────────────────────────────────────────────────────────────────────────────

interface ResolvedKeys {
    primary: 'gemini' | 'openai' | null;
    geminiKey?: string;
    openaiKey?: string;
}

async function resolveKeys(): Promise<ResolvedKeys> {
    // AI settings live in their own 'ai_settings' row, NOT in 'recruitment_status'.
    // The latter is world-readable (app_settings_select_public) because the apply
    // form needs it, so an API key stored there is public. 'ai_settings' is gated
    // behind app_settings_select_admin; non-admins get null.
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'ai_settings').maybeSingle();
    const aiSettings: AppSettings['aiSettings'] | undefined = data?.value;

    // Legacy `apiKey` was a single field shared by whichever provider was active;
    // fold it into the per-provider slot it was actually for so old configs keep working.
    const geminiKey = aiSettings?.geminiApiKey
        || (aiSettings?.provider === 'gemini' ? aiSettings?.apiKey : undefined)
        || import.meta.env.VITE_GEMINI_API_KEY;
    const openaiKey = aiSettings?.openaiApiKey
        || (aiSettings?.provider === 'openai' ? aiSettings?.apiKey : undefined)
        || import.meta.env.VITE_OPENAI_API_KEY;

    const preferred = aiSettings?.provider;
    const primary = preferred === 'gemini' && geminiKey ? 'gemini'
        : preferred === 'openai' && openaiKey ? 'openai'
        : geminiKey ? 'gemini'
        : openaiKey ? 'openai'
        : null;

    return { primary, geminiKey, openaiKey };
}

export async function analyzeCandidate(application: Application): Promise<AIAnalysisResult> {
    const { primary, geminiKey, openaiKey } = await resolveKeys();

    if (!primary) {
        throw new Error('AI Copilot is not configured. Add a Gemini and/or OpenAI API key under Admin → System Configuration → AI Copilot.');
    }

    const prompt = buildPrompt(application);
    const secondary = primary === 'gemini' ? 'openai' : 'gemini';
    const secondaryKey = secondary === 'gemini' ? geminiKey : openaiKey;

    try {
        return await (primary === 'gemini' ? runGeminiAnalysis(prompt, geminiKey!) : runOpenAIAnalysis(prompt, openaiKey!));
    } catch (primaryErr) {
        if (!secondaryKey) throw primaryErr;
        console.warn(`[AI Copilot] Primary provider "${primary}" failed, falling back to "${secondary}".`, primaryErr);
        try {
            return await (secondary === 'gemini' ? runGeminiAnalysis(prompt, secondaryKey) : runOpenAIAnalysis(prompt, secondaryKey));
        } catch (secondaryErr) {
            const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
            const secondaryMsg = secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr);
            throw new Error(`Both providers failed.\n${primary}: ${primaryMsg}\n${secondary}: ${secondaryMsg}`);
        }
    }
}

/** Persists a computed analysis onto the application row so it's cached for next
 * time and available to batch tooling like auto-shortlist. Callers should also
 * update their own in-memory state — this only writes through to the DB. */
export async function saveAnalysisToDb(applicationId: string, analysis: AIAnalysisResult): Promise<void> {
    const { error } = await supabase
        .from('applications')
        .update({ ai_analysis: analysis, ai_analyzed_at: new Date().toISOString() })
        .eq('id', applicationId);
    if (error) console.error('[AI Copilot] Failed to cache analysis:', error);
}

export interface BatchAnalysisProgress {
    completed: number;
    total: number;
    current?: string; // applicant name currently in flight
}

/**
 * Analyzes many applications with limited concurrency so we don't immediately
 * trip a provider's requests-per-minute limit. Skips applications that already
 * carry a cached aiAnalysis unless `force` is set. Persists each result as it
 * completes and reports progress via onProgress.
 */
export async function analyzeCandidatesBatch(
    applications: Application[],
    options: { force?: boolean; concurrency?: number; onProgress?: (p: BatchAnalysisProgress) => void; onResult?: (applicationId: string, analysis: AIAnalysisResult | null, error?: string) => void } = {}
): Promise<Map<string, AIAnalysisResult>> {
    const { force = false, concurrency = 3, onProgress, onResult } = options;
    const targets = force ? applications : applications.filter(a => !a.aiAnalysis);
    const results = new Map<string, AIAnalysisResult>();
    let completed = 0;
    let index = 0;

    const worker = async () => {
        for (; ;) {
            const i = index++;
            if (i >= targets.length) return;
            const app = targets[i];
            try {
                const analysis = await analyzeCandidate(app);
                results.set(app.id, analysis);
                await saveAnalysisToDb(app.id, analysis);
                onResult?.(app.id, analysis);
            } catch (err) {
                console.error(`[AI Copilot] Batch analysis failed for ${app.fullName}:`, err);
                onResult?.(app.id, null, err instanceof Error ? err.message : String(err));
            } finally {
                completed++;
                onProgress?.({ completed, total: targets.length, current: app.fullName });
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Committee-Fit Analysis — a SEPARATE prompt from buildPrompt() above.
//
// buildPrompt() (resume-fit) reads skills/reason/links: it is asking "does this
// person look qualified on paper for their chosen department?" and runs before
// anyone has been interviewed.
//
// This one runs AFTER interviews. It is asking a narrower question: "of the
// departments this candidate is actually eligible for — what they applied to,
// or what an interviewer recommended — which one does the marks + interviewer
// feedback best support?" It deliberately never sees skills/reason/links, and
// it is never allowed to answer with a department outside the eligible list
// it's given: this exists specifically so a candidate is never allocated
// somewhere they have no stated connection to. See CommitteeDraftBoard.tsx,
// which enforces the eligible-list restriction again on the client side by
// discarding any answer outside what it asked for.
// ─────────────────────────────────────────────────────────────────────────────

export interface CommitteeFitInput {
    id: string;
    fullName: string;
    /** Formatted "Task Score: 7.5/10, Interview Score: 8.2/10, ..." — marks only. */
    marksSummary: string;
    /** Concatenated interviewer comments/remarks. Empty string if none were left. */
    feedbackText: string;
    /** The ONLY departments the AI may choose between. Never empty when this is called. */
    eligibleDepts: string[];
}

export interface CommitteeFitResult {
    department: string;
    confidence: number; // 0-100
    reasoning: string;
    mode: 'gemini' | 'openai';
    /** True if the provider's answer wasn't one of eligibleDepts and had to be
     *  discarded in favour of the first eligible option — surfaced so the UI can
     *  flag a low-trust result instead of silently presenting it as a real pick. */
    corrected: boolean;
}

function buildCommitteeFitPrompt(input: CommitteeFitInput): string {
    const choices = input.eligibleDepts.map((d, i) => `${i + 1}. ${d}`).join('\n');
    return `You are helping an IEEE Solid-State Circuits Society (SSCS) student chapter decide which committee department a candidate should be placed in, now that their interview is complete.

Candidate: ${input.fullName}

Marks (this is the ONLY performance signal you have — there is no resume or application text):
${input.marksSummary}

Interviewer feedback:
${input.feedbackText || '(No written feedback was left by the interviewer.)'}

The candidate may ONLY be placed in one of the following departments — each is either a department they applied for, or a department an interviewer explicitly recommended them for. Do not suggest any department outside this list, even if the feedback mentions other skills:
${choices}

Pick the single best department from that numbered list, based only on the marks and the interviewer feedback above. Return ONLY a valid JSON object, no markdown, no code fences:
{
  "department": "the exact text of one department from the numbered list above",
  "confidence": number 0-100, how confident you are this is the right call given the evidence,
  "reasoning": "1-2 sentences citing the specific marks or feedback that justify this department over the other eligible option(s)"
}`;
}

function parseCommitteeFitJson(text: string, mode: 'gemini' | 'openai', eligibleDepts: string[]): Omit<CommitteeFitResult, 'mode'> & { mode: typeof mode } {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(cleaned);

    const rawDept = typeof parsed.department === 'string' ? parsed.department.trim() : '';
    // Exact match first, then case-insensitive — models occasionally alter casing
    // even when told to return exact text.
    const matched = eligibleDepts.find(d => d === rawDept)
        || eligibleDepts.find(d => d.toLowerCase() === rawDept.toLowerCase());

    const confidence = Number(parsed.confidence);
    return {
        department: matched || eligibleDepts[0],
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 50,
        reasoning: typeof parsed.reasoning === 'string' && parsed.reasoning.trim() ? parsed.reasoning.trim() : 'No reasoning provided.',
        mode,
        corrected: !matched,
    };
}

/**
 * Analyzes one candidate's committee-department fit using marks + interviewer
 * feedback only. Mirrors analyzeCandidate()'s primary-provider-with-fallback
 * shape above (kept as its own small copy rather than a shared helper, since
 * the two now return different result types and analyzeCandidate() is on the
 * hot path for the existing, already-relied-upon resume-fit feature — not
 * worth the regression risk of routing it through a new generic).
 */
export async function analyzeCommitteeFit(input: CommitteeFitInput): Promise<CommitteeFitResult> {
    if (input.eligibleDepts.length === 0) {
        throw new Error(`${input.fullName} has no eligible department (no preference and no interviewer recommendation) — nothing for the AI to choose between.`);
    }
    if (input.eligibleDepts.length === 1) {
        // Nothing to decide — nowhere else they could go.
        return { department: input.eligibleDepts[0], confidence: 100, reasoning: 'Only eligible department.', mode: 'gemini', corrected: false };
    }

    const { primary, geminiKey, openaiKey } = await resolveKeys();
    if (!primary) {
        throw new Error('AI Copilot is not configured. Add a Gemini and/or OpenAI API key under Admin → System Configuration → AI Copilot.');
    }

    const prompt = buildCommitteeFitPrompt(input);
    const secondary = primary === 'gemini' ? 'openai' : 'gemini';
    const secondaryKey = secondary === 'gemini' ? geminiKey : openaiKey;

    const call = async (provider: 'gemini' | 'openai', key: string): Promise<CommitteeFitResult> => {
        const text = provider === 'gemini' ? await callGeminiRaw(prompt, key) : await callOpenAIRaw(prompt, key);
        return parseCommitteeFitJson(text, provider, input.eligibleDepts);
    };

    try {
        return await call(primary, (primary === 'gemini' ? geminiKey : openaiKey)!);
    } catch (primaryErr) {
        if (!secondaryKey) throw primaryErr;
        console.warn(`[AI Copilot] Committee-fit: primary provider "${primary}" failed, falling back to "${secondary}".`, primaryErr);
        try {
            return await call(secondary, secondaryKey);
        } catch (secondaryErr) {
            const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
            const secondaryMsg = secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr);
            throw new Error(`Both providers failed.\n${primary}: ${primaryMsg}\n${secondary}: ${secondaryMsg}`);
        }
    }
}

export interface CommitteeFitProgress {
    completed: number;
    total: number;
    current?: string;
}

/**
 * Batch version of analyzeCommitteeFit, same bounded-concurrency shape as
 * analyzeCandidatesBatch(). Does not persist anything to the DB — the caller
 * (CommitteeDraftBoard) treats these as a draft suggestion, not a fact, until
 * an admin reviews and applies them.
 */
export async function analyzeCommitteeFitBatch(
    inputs: CommitteeFitInput[],
    options: { concurrency?: number; onProgress?: (p: CommitteeFitProgress) => void; onResult?: (id: string, result: CommitteeFitResult | null, error?: string) => void } = {}
): Promise<Map<string, CommitteeFitResult>> {
    const { concurrency = 3, onProgress, onResult } = options;
    const results = new Map<string, CommitteeFitResult>();
    let completed = 0;
    let index = 0;

    const worker = async () => {
        for (; ;) {
            const i = index++;
            if (i >= inputs.length) return;
            const input = inputs[i];
            try {
                const result = await analyzeCommitteeFit(input);
                results.set(input.id, result);
                onResult?.(input.id, result);
            } catch (err) {
                console.error(`[AI Copilot] Committee-fit batch failed for ${input.fullName}:`, err);
                onResult?.(input.id, null, err instanceof Error ? err.message : String(err));
            } finally {
                completed++;
                onProgress?.({ completed, total: inputs.length, current: input.fullName });
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, worker));
    return results;
}
