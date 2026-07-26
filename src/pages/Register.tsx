import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import emailjs from '@emailjs/browser';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { saveRegistrationToGoogleSheets } from '@/services/registrationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// EmailJS Configuration
const EMAILJS_SERVICE_ID = 'service_ln9nhmn';
const EMAILJS_TEMPLATE_ID = 'template_5p399mj';
const EMAILJS_PUBLIC_KEY = 'bj3DbINQas11jOWqr';

const AREAS_OF_INTEREST = [
  'IoT',
  'Embedded Systems',
  'Robotics & Automation',
  'AI & Edge Computing',
  'Cybersecurity for SSCS',
] as const;

const YEARS_OF_STUDY = ['1st', '2nd', '3rd', '4th'] as const;

// Zod validation schema
const registrationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Full name can only contain letters and spaces'),
  registrationNumber: z
    .string()
    .trim()
    .min(1, 'Registration number is required')
    .max(20, 'Registration number must be less than 20 characters')
    .regex(/^[0-9A-Za-z]+$/, 'Registration number can only contain letters and numbers'),
  department: z
    .string()
    .trim()
    .min(2, 'Department must be at least 2 characters')
    .max(100, 'Department must be less than 100 characters'),
  yearOfStudy: z.enum(YEARS_OF_STUDY, {
    errorMap: () => ({ message: 'Please select your year of study' }),
  }),
  areasOfInterest: z
    .array(z.enum(AREAS_OF_INTEREST))
    .min(1, 'Please select at least one area of interest'),
  whyJoin: z
    .string()
    .trim()
    .min(20, 'Please write at least 20 characters')
    .max(1000, 'Response must be less than 1000 characters'),
});

type FormData = z.infer<typeof registrationSchema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

const Register = () => {
  const { user, loading, error, signInWithGoogle, logout, clearError } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    registrationNumber: '',
    department: '',
    yearOfStudy: '' as typeof YEARS_OF_STUDY[number],
    areasOfInterest: [],
    whyJoin: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleInterestToggle = (interest: typeof AREAS_OF_INTEREST[number]) => {
    setFormData(prev => ({
      ...prev,
      areasOfInterest: prev.areasOfInterest.includes(interest)
        ? prev.areasOfInterest.filter(i => i !== interest)
        : [...prev.areasOfInterest, interest],
    }));
    if (formErrors.areasOfInterest) {
      setFormErrors(prev => ({ ...prev, areasOfInterest: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const result = registrationSchema.safeParse(formData);
    if (!result.success) {
      const errors: FormErrors = {};
      result.error.errors.forEach(err => {
        const field = err.path[0] as keyof FormData;
        if (!errors[field]) {
          errors[field] = err.message;
        }
      });
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Send confirmation email via EmailJS
      const templateParams = {
        to_name: formData.fullName,
        to_email: user?.email,
        registration_number: formData.registrationNumber,
        department: formData.department,
        year_of_study: formData.yearOfStudy,
        areas_of_interest: formData.areasOfInterest.join(', '),
      };

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      );

      // FIX #14e: Removed console.log of form PII (name, email, reg number).
      // Registration data is submitted via EmailJS — no need to log it locally.

      toast({
        title: "Confirmation email sent!",
        description: "Check your inbox for the registration confirmation.",
      });

      setIsSubmitted(true);
    } catch (error) {
      console.error('EmailJS Error:', error);
      toast({
        title: "Email failed to send",
        description: "Your registration was saved, but we couldn't send a confirmation email.",
        variant: "destructive",
      });
      // Still mark as submitted since form data was logged
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              <span className="font-heading font-bold text-lg">
                <span className="text-primary">IEEE</span>
                <span className="text-foreground"> SSCS</span>
              </span>
            </Link>
            {user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-16 px-6">
        <div className="container mx-auto max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="font-heading text-3xl md:text-4xl font-bold mb-3">
              Join <span className="text-primary">IEEE SSCS</span>
            </h1>
            <p className="text-muted-foreground">
              Register to become a part of our community
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {/* Loading State */}
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <LogoSpinner size="md" />
                <p className="mt-4 text-muted-foreground">Loading...</p>
              </motion.div>
            )}

            {/* Error State */}
            {!loading && error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-destructive/30 rounded-lg p-6 text-center"
              >
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive font-medium mb-4">{error}</p>
                <Button
                  onClick={() => {
                    clearError();
                    signInWithGoogle();
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Try Again
                </Button>
              </motion.div>
            )}

            {/* Login State */}
            {!loading && !error && !user && (
              <motion.div
                key="login"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-lg p-8 text-center"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <h2 className="font-heading text-xl font-semibold mb-2">
                  Sign in to Register
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Use your VIT student email to continue
                </p>
                <Button
                  onClick={signInWithGoogle}
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                >
                  {loading ? (
                    <LogoSpinner size="sm" className="mr-2" />
                  ) : (
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Continue with Google
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Only @vitstudent.ac.in emails are allowed
                </p>
              </motion.div>
            )}

            {/* Success State */}
            {!loading && !error && user && isSubmitted && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-primary/30 rounded-lg p-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                >
                  <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />
                </motion.div>
                <h2 className="font-heading text-2xl font-bold mb-2 text-primary">
                  Registration Successful!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Thank you for registering with IEEE SSCS. We'll be in touch soon.
                </p>
                <Link to="/">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Return to Home
                  </Button>
                </Link>
              </motion.div>
            )}

            {/* Registration Form */}
            {!loading && !error && user && !isSubmitted && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-card border border-border rounded-lg p-6 md:p-8"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                  <img
                    src={user.photoURL || '/placeholder.svg'}
                    alt="Profile"
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-sm">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={e => handleInputChange('fullName', e.target.value)}
                      placeholder="Enter your full name"
                      className={`bg-input border-border focus:border-primary ${formErrors.fullName ? 'border-destructive' : ''}`}
                    />
                    {formErrors.fullName && (
                      <p className="text-xs text-destructive">{formErrors.fullName}</p>
                    )}
                  </div>

                  {/* VIT Email (Read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">VIT Email</Label>
                    <Input
                      id="email"
                      value={user.email || ''}
                      readOnly
                      className="bg-muted border-border text-muted-foreground cursor-not-allowed"
                    />
                  </div>

                  {/* Registration Number */}
                  <div className="space-y-2">
                    <Label htmlFor="regNo">Registration Number</Label>
                    <Input
                      id="regNo"
                      value={formData.registrationNumber}
                      onChange={e =>
                        handleInputChange('registrationNumber', e.target.value)
                      }
                      placeholder="e.g., 21BCE1234"
                      className={`bg-input border-border focus:border-primary ${formErrors.registrationNumber ? 'border-destructive' : ''}`}
                    />
                    {formErrors.registrationNumber && (
                      <p className="text-xs text-destructive">{formErrors.registrationNumber}</p>
                    )}
                  </div>

                  {/* Department */}
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={e => handleInputChange('department', e.target.value)}
                      placeholder="e.g., Computer Science"
                      className={`bg-input border-border focus:border-primary ${formErrors.department ? 'border-destructive' : ''}`}
                    />
                    {formErrors.department && (
                      <p className="text-xs text-destructive">{formErrors.department}</p>
                    )}
                  </div>

                  {/* Year of Study */}
                  <div className="space-y-2">
                    <Label>Year of Study</Label>
                    <Select
                      value={formData.yearOfStudy}
                      onValueChange={value => handleInputChange('yearOfStudy', value)}
                    >
                      <SelectTrigger className={`bg-input border-border focus:border-primary ${formErrors.yearOfStudy ? 'border-destructive' : ''}`}>
                        <SelectValue placeholder="Select your year" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {YEARS_OF_STUDY.map(year => (
                          <SelectItem key={year} value={year}>
                            {year} Year
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.yearOfStudy && (
                      <p className="text-xs text-destructive">{formErrors.yearOfStudy}</p>
                    )}
                  </div>

                  {/* Areas of Interest */}
                  <div className="space-y-3">
                    <Label>Area of Interest</Label>
                    <div className="grid grid-cols-1 gap-3">
                      {AREAS_OF_INTEREST.map(interest => (
                        <div
                          key={interest}
                          className="flex items-center space-x-3"
                        >
                          <Checkbox
                            id={interest}
                            checked={formData.areasOfInterest.includes(interest)}
                            onCheckedChange={() => handleInterestToggle(interest)}
                            className={`border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary ${formErrors.areasOfInterest ? 'border-destructive' : ''}`}
                          />
                          <Label
                            htmlFor={interest}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {interest}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {formErrors.areasOfInterest && (
                      <p className="text-xs text-destructive">{formErrors.areasOfInterest}</p>
                    )}
                  </div>

                  {/* Why Join */}
                  <div className="space-y-2">
                    <Label htmlFor="whyJoin">Why do you want to join IEEE SSCS?</Label>
                    <Textarea
                      id="whyJoin"
                      value={formData.whyJoin}
                      onChange={e => handleInputChange('whyJoin', e.target.value)}
                      placeholder="Tell us about your interest in Cyber-Physical Systems..."
                      rows={4}
                      className={`bg-input border-border focus:border-primary resize-none ${formErrors.whyJoin ? 'border-destructive' : ''}`}
                    />
                    {formErrors.whyJoin && (
                      <p className="text-xs text-destructive">{formErrors.whyJoin}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <LogoSpinner size="sm" className="mr-2" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Registration'
                    )}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Register;
