
export interface RegNoDetails {
    isValid: boolean;
    error?: string;
    admissionYear?: number;
    programCode?: string;
    programName?: string;
    batch?: string;
    programCategory?: 'Engineering' | 'SSCS' | 'Interdisciplinary' | 'Robotics' | 'Computer Science' | 'Electronics' | 'Mechanical';
}

const PROGRAM_MAP: Record<string, { name: string, category: RegNoDetails['programCategory'] }> = {
    'BPS': { name: '', category: 'SSCS' },
    'BAI': { name: '', category: 'Computer Science' },
    'BRS': { name: '', category: 'Robotics' },
    'BYB': { name: '', category: 'Computer Science' },
    'BCE': { name: '', category: 'Computer Science' },
    'BME': { name: '', category: 'Mechanical' },
    'BMV': { name: '', category: 'Mechanical' },
    'BEC': { name: '', category: 'Electronics' },
    'BCL': { name: '', category: 'Electronics' },
    'BDS': { name: 'Data Science', category: 'Computer Science' }
};

export const validateRegistrationNumber = (regNo: string): RegNoDetails => {
    // Normalization
    const normalized = regNo ? regNo.trim().toUpperCase() : '';

    // Strict Format: YY<CODE><XXXX> -> 2 digits + 3 letters + 4 digits
    // Total length: 2 + 3 + 4 = 9 characters
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
    // Assuming 2000s. 24 -> 2024. 
    // Logic for batch: Standard B.Tech is 4 years.
    const admissionYear = 2000 + yearSuffix;
    const gradYear = admissionYear + 4;
    const batch = `${admissionYear}-${gradYear}`;

    return {
        isValid: true,
        admissionYear,
        programCode: code,
        programName: programInfo.name,
        batch,
        programCategory: programInfo.category
    };
};
