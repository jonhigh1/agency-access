'use client';

import { useRef, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiBaseUrl } from '@/lib/api/api-env';

interface FormData {
  name: string;
  email: string;
  company: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

const API_URL = getApiBaseUrl();

export function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const submissionInFlightRef = useRef(false);

  const validateForm = (data: FormData): boolean => {
    const newErrors: FormErrors = {};

    if (!data.name) {
      newErrors.name = 'Name is required';
    } else if (data.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!data.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!data.message) {
      newErrors.message = 'Message is required';
    } else if (data.message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    setErrors(newErrors);
    if (newErrors.name) nameInputRef.current?.focus();
    else if (newErrors.email) emailInputRef.current?.focus();
    else if (newErrors.message) messageInputRef.current?.focus();
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlightRef.current) return;

    const normalizedFormData = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      company: formData.company.trim(),
      message: formData.message.trim(),
    };

    if (!validateForm(normalizedFormData)) return;

    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizedFormData),
      });

      const data = await response.json();

      if (response.ok && data.data?.success) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', company: '', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch {
      setSubmitStatus('error');
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing (only for validated fields)
    if ((field === 'name' || field === 'email' || field === 'message') && errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Input styles - brutalist aesthetic with proper validation states
  const inputBaseClasses = `
    w-full px-4 py-3 border-2 border-black bg-white text-ink
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-coral
    transition-all duration-200 font-sans
  `;

  const inputErrorClasses = 'border-red-500 focus:ring-red-200';
  const inputValidClasses = 'focus:ring-coral';

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {submitStatus === 'success' ? (
          <m.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-teal/10 border-2 border-teal rounded-lg p-8 text-center"
          >
            <CheckCircle className="w-16 h-16 text-success-ink mx-auto mb-4" />
            <h3 className="font-display text-2xl font-bold text-ink mb-2">
              Message Sent!
            </h3>
            <p className="text-gray-600 mb-4">
              Thanks for reaching out. We&apos;ll get back to you within 24 hours.
            </p>
            <Button
              variant="secondary"
              onClick={() => setSubmitStatus('idle')}
              className="mt-4"
            >
              Send Another Message
            </Button>
          </m.div>
        ) : (
          <m.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Name Field */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Name <span className="text-danger-ink">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Your name"
                disabled={isSubmitting}
                className={`${inputBaseClasses} ${
                  errors.name ? inputErrorClasses : inputValidClasses
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              <AnimatePresence>
                {errors.name && (
                  <m.p
                    id="name-error"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
                    role="alert"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.name}
                  </m.p>
                )}
              </AnimatePresence>
            </div>

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Email <span className="text-danger-ink">*</span>
              </label>
              <input
                ref={emailInputRef}
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="you@company.com"
                disabled={isSubmitting}
                className={`${inputBaseClasses} ${
                  errors.email ? inputErrorClasses : inputValidClasses
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              <AnimatePresence>
                {errors.email && (
                  <m.p
                    id="email-error"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
                    role="alert"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.email}
                  </m.p>
                )}
              </AnimatePresence>
            </div>

            {/* Company Field (Optional) */}
            <div>
              <label
                htmlFor="company"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Company <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="text"
                id="company"
                value={formData.company}
                onChange={(e) => handleChange('company', e.target.value)}
                placeholder="Your company name"
                disabled={isSubmitting}
                className={`${inputBaseClasses} ${inputValidClasses} ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
            </div>

            {/* Message Field */}
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-semibold text-ink mb-1.5"
              >
                Message <span className="text-danger-ink">*</span>
              </label>
              <textarea
                ref={messageInputRef}
                id="message"
                value={formData.message}
                onChange={(e) => handleChange('message', e.target.value)}
                placeholder="How can we help you?"
                rows={5}
                disabled={isSubmitting}
                className={`${inputBaseClasses} resize-none ${
                  errors.message ? inputErrorClasses : inputValidClasses
                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? 'message-error' : undefined}
              />
              <AnimatePresence>
                {errors.message && (
                  <m.p
                    id="message-error"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-1.5 text-sm text-red-600 flex items-center gap-1"
                    role="alert"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {errors.message}
                  </m.p>
                )}
              </AnimatePresence>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="brutalist"
              size="lg"
              disabled={isSubmitting}
              className="w-full"
              isLoading={isSubmitting}
              leftIcon={isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : undefined}
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </Button>

            {/* Error Message */}
            <AnimatePresence>
              {submitStatus === 'error' && (
                <m.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-sm text-red-600 text-center flex items-center justify-center gap-2"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4" />
                  Something went wrong. Please try again or email us directly.
                </m.p>
              )}
            </AnimatePresence>
          </m.form>
        )}
      </AnimatePresence>
    </div>
  );
}
