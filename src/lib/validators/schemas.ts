import { z } from 'zod';

export const onboardingStep1Schema = z.object({
  role: z.enum(['founder', 'investor', 'analyst', 'student', 'other']),
});

export const onboardingStep2Schema = z.object({
  ai_topics: z
    .array(
      z.enum([
        'foundation_models',
        'infrastructure',
        'applications',
        'robotics',
        'hardware',
        'research',
        'other',
      ])
    )
    .min(1, 'Select at least one topic')
    .max(7),
});

export const onboardingStep3Schema = z.object({
  geographies: z
    .array(
      z.enum(['us', 'india', 'eu', 'israel', 'canada', 'uk', 'sea', 'global'])
    )
    .min(1, 'Select at least one geography')
    .max(8),
});

export const onboardingStep4Schema = z.object({
  stages: z
    .array(
      z.enum(['pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d', 'series_e', 'growth', 'public'])
    )
    .min(1, 'Select at least one stage')
    .max(7),
});

export const onboardingStep5Schema = z.object({
  follow_funds: z.array(z.string().uuid()).max(10).optional(),
  follow_companies: z.array(z.string().uuid()).max(10).optional(),
});

export const onboardingSchema = z.object({
  role: onboardingStep1Schema.shape.role,
  ai_topics: onboardingStep2Schema.shape.ai_topics,
  geographies: onboardingStep3Schema.shape.geographies,
  stages: onboardingStep4Schema.shape.stages,
  follow_funds: onboardingStep5Schema.shape.follow_funds,
  follow_companies: onboardingStep5Schema.shape.follow_companies,
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = loginSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const profileUpdateSchema = z.object({
  role: onboardingStep1Schema.shape.role.optional(),
  ai_topics: onboardingStep2Schema.shape.ai_topics.optional(),
  geographies: onboardingStep3Schema.shape.geographies.optional(),
  stages: onboardingStep4Schema.shape.stages.optional(),
});

export const alertRuleSchema = z.object({
  entity_type: z.enum(['fund', 'company']),
  entity_id: z.string().uuid(),
  trigger: z.enum([
    'new_funding_round',
    'new_portfolio_company',
    'thesis_update',
    'pattern_published',
    'any_announcement',
  ]),
  frequency: z.enum(['instant', 'daily', 'weekly']),
  channels: z.array(z.enum(['email', 'in_app'])).min(1),
  topic_filter: z
    .array(
      z.enum([
        'foundation_models',
        'infrastructure',
        'applications',
        'robotics',
        'hardware',
        'research',
        'other',
      ])
    )
    .optional(),
});

export const feedFilterSchema = z.object({
  topics: z
    .array(
      z.enum([
        'foundation_models',
        'infrastructure',
        'applications',
        'robotics',
        'hardware',
        'research',
        'other',
      ])
    )
    .optional(),
  geographies: z
    .array(z.enum(['us', 'india', 'eu', 'israel', 'canada', 'uk', 'sea', 'global']))
    .optional(),
  event_types: z
    .array(z.enum(['funding', 'launch', 'partnership', 'research', 'acquisition', 'other']))
    .optional(),
  companies: z.array(z.string().uuid()).optional(),
  investors: z.array(z.string().uuid()).optional(),
  yc_batches: z.array(z.string()).optional(),
  verified_only: z.boolean().optional(),
  sort: z.enum(['latest', 'relevance']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(['all', 'companies', 'funds', 'stories', 'patterns']).optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export type OnboardingStep1 = z.infer<typeof onboardingStep1Schema>;
export type OnboardingStep2 = z.infer<typeof onboardingStep2Schema>;
export type OnboardingStep3 = z.infer<typeof onboardingStep3Schema>;
export type OnboardingStep4 = z.infer<typeof onboardingStep4Schema>;
export type OnboardingStep5 = z.infer<typeof onboardingStep5Schema>;
export type OnboardingData = z.infer<typeof onboardingSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type SignupData = z.infer<typeof signupSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordData = z.infer<typeof updatePasswordSchema>;
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
export type AlertRuleData = z.infer<typeof alertRuleSchema>;
export type FeedFilterData = z.infer<typeof feedFilterSchema>;
export type SearchData = z.infer<typeof searchSchema>;
