'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/Select';
import { cn } from '@/lib/utils/helpers';
import { onboardingStep1Schema, onboardingStep2Schema, onboardingStep3Schema, onboardingStep4Schema, onboardingStep5Schema, type OnboardingStep1, type OnboardingStep2, type OnboardingStep3, type OnboardingStep4, type OnboardingStep5 } from '@/lib/validators/schemas';
import { AITheme, Geography, Stage, UserRole } from '@/types';

const STEPS = [
  { number: 1, title: 'Role', description: 'What best describes you?' },
  { number: 2, title: 'AI Topics', description: 'Which AI areas interest you?' },
  { number: 3, title: 'Geography', description: 'Which regions do you follow?' },
  { number: 4, title: 'Company Stage', description: 'What investment stages matter?' },
  { number: 5, title: 'Follow', description: 'Pick funds & companies to follow' },
];

const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: 'founder', label: 'AI Founder', description: 'Building an AI company' },
  { value: 'investor', label: 'Investor', description: 'Investing in AI companies' },
  { value: 'analyst', label: 'Analyst', description: 'Researching AI markets' },
  { value: 'student', label: 'Student', description: 'Learning about AI investing' },
  { value: 'other', label: 'Other', description: 'Other interest in AI' },
];

const TOPIC_OPTIONS: { value: AITheme; label: string; description: string }[] = [
  { value: 'foundation_models', label: 'Foundation Models', description: 'LLMs, multimodal models, model providers' },
  { value: 'infrastructure', label: 'Infrastructure', description: 'MLOps, compute, data platforms, dev tools' },
  { value: 'applications', label: 'Applications', description: 'Vertical AI apps, enterprise, consumer' },
  { value: 'robotics', label: 'Robotics', description: 'Embodied AI, automation, hardware' },
  { value: 'hardware', label: 'Hardware', description: 'AI chips, accelerators, edge devices' },
  { value: 'research', label: 'Research', description: 'Academic papers, open science, benchmarks' },
  { value: 'other', label: 'Other', description: 'Other AI-related topics' },
];

const GEOGRAPHY_OPTIONS: { value: Geography; label: string; description: string }[] = [
  { value: 'us', label: 'United States', description: 'Silicon Valley, NYC, Boston, etc.' },
  { value: 'india', label: 'India', description: 'Bengaluru, Mumbai, Delhi, Hyderabad' },
  { value: 'eu', label: 'European Union', description: 'Germany, France, Netherlands, etc.' },
  { value: 'israel', label: 'Israel', description: 'Tel Aviv, Jerusalem, Haifa' },
  { value: 'canada', label: 'Canada', description: 'Toronto, Montreal, Vancouver' },
  { value: 'uk', label: 'United Kingdom', description: 'London, Oxford, Cambridge' },
  { value: 'sea', label: 'Southeast Asia', description: 'Singapore, Indonesia, Vietnam' },
  { value: 'global', label: 'Global', description: 'No geographic preference' },
];

const STAGE_OPTIONS: { value: Stage; label: string; description: string }[] = [
  { value: 'pre_seed', label: 'Pre-seed', description: 'Idea stage, <$1M' },
  { value: 'seed', label: 'Seed', description: 'Product-Market Fit, $1-5M' },
  { value: 'series_a', label: 'Series A', description: 'Scaling, $5-20M' },
  { value: 'series_b', label: 'Series B', description: 'Growth, $20-50M' },
  { value: 'series_c', label: 'Series C+', description: 'Late stage, $50M+' },
  { value: 'growth', label: 'Growth', description: 'Pre-IPO, $100M+' },
  { value: 'public', label: 'Public', description: 'Listed companies' },
];

export default function OnboardingPage() {
  const router = useRouter();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Step 1: Role
  const step1Form = useForm<OnboardingStep1>({
    resolver: zodResolver(onboardingStep1Schema),
    defaultValues: { role: 'founder' },
  });
  
  // Step 2: AI Topics
  const step2Form = useForm<OnboardingStep2>({
    resolver: zodResolver(onboardingStep2Schema),
    defaultValues: { ai_topics: ['foundation_models', 'infrastructure'] },
  });
  
  // Step 3: Geography
  const step3Form = useForm<OnboardingStep3>({
    resolver: zodResolver(onboardingStep3Schema),
    defaultValues: { geographies: ['us', 'india'] },
  });
  
  // Step 4: Stage
  const step4Form = useForm<OnboardingStep4>({
    resolver: zodResolver(onboardingStep4Schema),
    defaultValues: { stages: ['seed', 'series_a'] },
  });
  
  // Step 5: Follow (will be populated with actual data)
  const step5Form = useForm<OnboardingStep5>({
    resolver: zodResolver(onboardingStep5Schema),
    defaultValues: { follow_funds: [], follow_companies: [] },
  });

  const handleNext = async (step: number) => {
    if (step === 1) {
      const valid = await step1Form.trigger();
      if (!valid) return;
    } else if (step === 2) {
      const valid = await step2Form.trigger();
      if (!valid) return;
    } else if (step === 3) {
      const valid = await step3Form.trigger();
      if (!valid) return;
    } else if (step === 4) {
      const valid = await step4Form.trigger();
      if (!valid) return;
    } else if (step === 5) {
      await completeOnboarding();
      return;
    }
    
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeOnboarding = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = {
        role: step1Form.getValues('role'),
        ai_topics: step2Form.getValues('ai_topics'),
        geographies: step3Form.getValues('geographies'),
        stages: step4Form.getValues('stages'),
        follow_funds: step5Form.getValues('follow_funds') || [],
        follow_companies: step5Form.getValues('follow_companies') || [],
      };

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Failed to complete onboarding');
      }

      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-text-secondary">What best describes you? This helps us personalize your feed.</p>
            <div className="grid gap-3" role="radiogroup" aria-label="Select your role">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => step1Form.setValue('role', role.value, { shouldValidate: true })}
                  className={cn(
                    'relative p-4 rounded-xl border-2 text-left transition-all',
                    step1Form.watch('role') === role.value
                      ? 'border-accent-blue bg-accent-blue/5'
                      : 'border-border-default hover:border-accent-blue/50'
                  )}
                  role="radio"
                  aria-checked={step1Form.watch('role') === role.value}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5',
                      step1Form.watch('role') === role.value
                        ? 'border-accent-blue bg-accent-blue'
                        : 'border-border-default'
                    )}>
                      {step1Form.watch('role') === role.value && (
                        <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{role.label}</div>
                      <div className="text-sm text-text-muted">{role.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {step1Form.formState.errors.role && (
              <p className="text-sm text-accent-red" role="alert">{step1Form.formState.errors.role.message}</p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-text-secondary">Which AI areas interest you? Select at least one (max 7).</p>
            <MultiSelect
              label="AI Topics"
              options={TOPIC_OPTIONS}
              value={step2Form.watch('ai_topics')}
              onChange={(value) => step2Form.setValue('ai_topics', value, { shouldValidate: true })}
              placeholder="Select AI topics..."
              maxSelections={7}
            />
            {step2Form.formState.errors.ai_topics && (
              <p className="text-sm text-accent-red" role="alert">{step2Form.formState.errors.ai_topics.message}</p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-text-secondary">Which regions do you follow? Select at least one (max 8).</p>
            <MultiSelect
              label="Geography"
              options={GEOGRAPHY_OPTIONS}
              value={step3Form.watch('geographies')}
              onChange={(value) => step3Form.setValue('geographies', value, { shouldValidate: true })}
              placeholder="Select geographies..."
              maxSelections={8}
            />
            {step3Form.formState.errors.geographies && (
              <p className="text-sm text-accent-red" role="alert">{step3Form.formState.errors.geographies.message}</p>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-text-secondary">What investment stages matter? Select at least one (max 7).</p>
            <MultiSelect
              label="Company Stage"
              options={STAGE_OPTIONS}
              value={step4Form.watch('stages')}
              onChange={(value) => step4Form.setValue('stages', value, { shouldValidate: true })}
              placeholder="Select stages..."
              maxSelections={7}
            />
            {step4Form.formState.errors.stages && (
              <p className="text-sm text-accent-red" role="alert">{step4Form.formState.errors.stages.message}</p>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <p className="text-text-secondary">Pick funds & companies to follow (optional, max 10 each). You can edit later.</p>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Funds to follow</label>
              <MultiSelect
                options={[]} // Will be populated with actual fund data
                value={step5Form.watch('follow_funds') ?? []}
                onChange={(value) => step5Form.setValue('follow_funds', value)}
                placeholder="Search funds..."
                maxSelections={10}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Companies to follow</label>
              <MultiSelect
                options={[]} // Will be populated with actual company data
                value={step5Form.watch('follow_companies') ?? []}
                onChange={(value) => step5Form.setValue('follow_companies', value)}
                placeholder="Search companies..."
                maxSelections={10}
              />
            </div>
            
            <p className="text-sm text-text-muted">You can skip this step and customize later in Settings → Personalization.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <header className="border-b border-border-default bg-bg-primary/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-bold text-text-primary">Ventro</span>
            <span className="text-sm text-text-muted">Step {currentStep} of 5</span>
          </div>
          <div className="relative h-2 bg-bg-tertiary rounded-full overflow-hidden" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={5}>
            <div
              className="h-full bg-accent-blue transition-all duration-300"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-text-muted">
            {STEPS.map((step, index) => (
              <span key={step.number} className={cn(index < currentStep ? 'text-accent-blue' : '', index === currentStep - 1 ? 'font-medium' : '')}>
                {step.title}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className="bg-bg-secondary border border-border-default rounded-xl p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">{STEPS[currentStep - 1].title}</h2>
              <p className="text-text-secondary">{STEPS[currentStep - 1].description}</p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-lg bg-accent-red/10 text-accent-red text-sm" role="alert">
                {error}
              </div>
            )}

            {renderStep()}

            <div className="mt-8 flex justify-between pt-6 border-t border-border-default">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                Back
              </Button>
              <Button
                onClick={() => handleNext(currentStep)}
                loading={loading}
                disabled={loading}
              >
                {currentStep === 5 ? 'Complete Setup' : 'Next'}
              </Button>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-text-muted">
            All steps are skippable. Customize anytime in Settings.
          </p>
        </div>
      </main>
    </div>
  );
}
