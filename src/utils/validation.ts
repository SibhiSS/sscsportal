
export interface RegNoDetails {
    isValid: boolean;
    error?: string;
    admissionYear?: number;
    programCode?: string;
    programName?: string;
    batch?: string;
    programCategory?: 'Engineering' | 'SSCS' | 'Interdisciplinary' | 'Robotics' | 'Computer Science' | 'Electronics' | 'Mechanical';
}

const PROGRAM_MAP: Record<string, { name: string, category: RegNoDetails['programCategory'], duration: number }> = {
    // CSE Variants
    'BCE': { name: 'B.Tech Computer Science & Engineering', category: 'Computer Science', duration: 4 },
    'BAI': { name: 'B.Tech CSE (Specialisation in AIML)', category: 'Computer Science', duration: 4 },
    'BBS': { name: 'B.Tech CSE (Specialisation in Business Systems)', category: 'Computer Science', duration: 4 },
    'BCB': { name: 'B.Tech CSE (Specialisation in Bio)', category: 'Computer Science', duration: 4 },
    'BCG': { name: 'B.Tech CSE (Specialisation in Gaming Technology)', category: 'Computer Science', duration: 4 },
    'BCI': { name: 'B.Tech CSE (Specialisation in Info Security)', category: 'Computer Science', duration: 4 },
    'BCT': { name: 'B.Tech CSE (Specialisation in IOT)', category: 'Computer Science', duration: 4 },
    'BCY': { name: 'B.Tech CSE (Specialisation in Cyber Security)', category: 'Computer Science', duration: 4 },
    'BDS': { name: 'B.Tech CSE (Specialisation in Data Science)', category: 'Computer Science', duration: 4 },
    'BEY': { name: 'B.Tech CSE (Specialisation in E-Commerce Technology)', category: 'Computer Science', duration: 4 },
    'BHI': { name: 'B.Tech CSE (Specialisation in Health Informatics)', category: 'Computer Science', duration: 4 },
    'BKT': { name: 'B.Tech CSE (Specialisation in Blockchain)', category: 'Computer Science', duration: 4 },
    'BPS': { name: 'B.Tech CSE (Specialisation in Cyber Physical Systems)', category: 'Computer Science', duration: 4 },
    'BRS': { name: 'B.Tech CSE (Specialisation in AI & Robotics)', category: 'Computer Science', duration: 4 },
    'BSA': { name: 'B.Tech CSE (Specialisation in Cloud Computing & Auto)', category: 'Computer Science', duration: 4 },
    'BIT': { name: 'B.Tech Information Technology', category: 'Computer Science', duration: 4 },

    // ECE & EEE Variants
    'BAC': { name: 'B.Tech ECE (Specialisation in AI)', category: 'Electronics', duration: 4 },
    'BLC': { name: 'B.Tech Electronics and Computers', category: 'Electronics', duration: 4 },
    'BEE': { name: 'B.Tech Electrical Engineering', category: 'Electronics', duration: 4 },
    'BEC': { name: 'B.Tech Electronics Communication(ECE)', category: 'Electronics', duration: 4 },
    'BEI': { name: 'B.Tech Electronics and Instrumentation', category: 'Electronics', duration: 4 },
    'BML': { name: 'B.Tech ECE (Specialisation in Biomedical Engineering)', category: 'Electronics', duration: 4 },

    // Mechanical Variants
    'BMA': { name: 'B.Tech ME (Specialisation in Automation)', category: 'Mechanical', duration: 4 },
    'BME': { name: 'B.Tech Mechanical Engineering', category: 'Mechanical', duration: 4 },
    'BMH': { name: 'B.Tech Mechatronics', category: 'Mechanical', duration: 4 },
    'BMM': { name: 'B.Tech ME (Specialisation in Manufacturing)', category: 'Mechanical', duration: 4 },
    'BMV': { name: 'B.Tech ME (Specialisation in EVs)', category: 'Mechanical', duration: 4 },

    // Other Engineering
    'BBT': { name: 'B.Tech Biotechnology', category: 'Engineering', duration: 4 },
    'BCL': { name: 'B.Tech Civil Engineering', category: 'Engineering', duration: 4 },
    'BCM': { name: 'B.Tech Chemical Engineering', category: 'Engineering', duration: 4 },
    'BOE': { name: 'B.Tech Bioengineering', category: 'Engineering', duration: 4 },

    // Integrated M.Tech (5 Years)
    'MCA': { name: 'Integrated M.Tech Computer Science & Engineering', category: 'Computer Science', duration: 5 },
    'MIA': { name: 'Integrated M.Tech CSE (Specialisation in AIML)', category: 'Computer Science', duration: 5 },
    'MDT': { name: 'Integrated M.Tech CSE (Specialisation in Data Science)', category: 'Computer Science', duration: 5 },
    'MIS': { name: 'Integrated M.Tech CSE (Specialisation in Information Security)', category: 'Computer Science', duration: 5 }
};

export const validateRegistrationNumber = (regNo: string): RegNoDetails => {
    // Normalization
    const normalized = regNo ? regNo.trim().toUpperCase() : '';

    const regex = /^(\d{2})([A-Z]{3})(\d{4})$/;

    if (!normalized) {
        return { isValid: false, error: 'Registration number is required' };
    }

    const match = normalized.match(regex);
    if (!match) {
        return {
            isValid: false,
            error: 'Invalid format. Must be YY<CODE>XXXX (e.g., 24BPS1104)'
        };
    }

    const [_, yearStr, code, serial] = match;
    const programInfo = PROGRAM_MAP[code];

    if (!programInfo) {
        return {
            isValid: false,
            error: `Unsupported program code: ${code}. Please check the valid codes.`
        };
    }

    const yearSuffix = parseInt(yearStr, 10);
    const admissionYear = 2000 + yearSuffix;
    const gradYear = admissionYear + (programInfo.duration || 4);
    const batch = `${admissionYear}-${gradYear} batch`;

    return {
        isValid: true,
        admissionYear,
        programCode: code,
        programName: programInfo.name,
        batch,
        programCategory: programInfo.category
    };
};
