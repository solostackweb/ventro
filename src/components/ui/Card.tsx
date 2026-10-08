'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/helpers';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, hover, padding = 'md', ...props }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      {...props}
      className={cn(
        'rounded-md border border-rule bg-research transition-[border-color,background-color,box-shadow]',
        hover && 'cursor-pointer hover:border-cyan-700/40 hover:bg-white hover:shadow-[0_12px_36px_rgba(4,21,34,0.08)]',
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 border-b border-rule pb-3', className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mt-4 flex items-center gap-2 border-t border-rule pt-3', className)}>
      {children}
    </div>
  );
}
