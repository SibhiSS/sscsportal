const GOOGLE_SHEETS_URL = import.meta.env.VITE_GOOGLE_SHEETS_API_URL;

interface RegistrationData {
  fullName: string;
  email: string;
  registrationNumber: string;
  department: string;
  yearOfStudy: string;
  areasOfInterest: string[];
  whyJoin: string;
}

export const saveRegistrationToGoogleSheets = async (data: RegistrationData) => {
  try {
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to save registration');
    }

    const result = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.message);
    }

    return result;
  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
    throw error;
  }
};
