'use client';

import { cn } from '@/lib/utils/helpers';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'verified' | 'partial' | 'unverified' | 'conflicted' | 'blue' | 'green' | 'amber' | 'red' | 'purple';
  className?: string;
  dot?: boolean;
}

export function Badge({ children, variant = 'default', className, dot }: BadgeProps) {
  const variants = {
    default: 'bg-bg-tertiary text-text-secondary',
    verified: 'bg-badge-verified text-white',
    partial: 'bg-badge-partial text-white',
    unverified: 'bg-badge-unverified text-white',
    conflicted: 'bg-badge-conflicted text-white',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function VerificationBadge({ status }: { status: 'verified' | 'partial' | 'unverified' | 'conflicted' }) {
  const labels = {
    verified: 'Verified',
    partial: 'Partial',
    unverified: 'Unverified',
    conflicted: 'Conflicted',
  };

  return <Badge variant={status}>{labels[status]}</Badge>;
}