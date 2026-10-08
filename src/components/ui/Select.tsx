'use client';

import { forwardRef, SelectHTMLAttributes, OptionHTMLAttributes, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/helpers';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, placeholder, options, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-text-secondary mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'min-h-11 w-full appearance-none rounded-md border bg-white px-3 py-2 text-sm text-ink-950 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20',
            error ? 'border-accent-red' : 'border-border-default',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="mt-1 text-sm text-accent-red" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="mt-1 text-sm text-text-muted">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

interface MultiSelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

interface MultiSelectProps<T extends string = string> {
  label?: string;
  error?: string;
  hint?: string;
  options: MultiSelectOption[];
  value: T[];
  onChange: (value: T[]) => void;
  placeholder?: string;
  maxSelections?: number;
  searchable?: boolean;
}

export function MultiSelect<T extends string>({ label, error, hint, options, value, onChange, placeholder, maxSelections, searchable = true }: MultiSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  const filteredOptions = searchable
    ? options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()) || opt.value.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selectedOptions = options.filter((opt) => value.includes(opt.value as T));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue as T)) {
      onChange(value.filter((v) => v !== optionValue));
    } else if (!maxSelections || value.length < maxSelections) {
      onChange([...value, optionValue as T]);
    }
  };

  return (
    <div className="w-full relative">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
      )}
      
      <div
        ref={buttonRef}
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen); } }}
        className={cn(
          'min-h-11 w-full cursor-pointer rounded-md border bg-white px-3 py-2 text-left text-sm text-ink-950 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20',
          error ? 'border-accent-red' : 'border-border-default'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex flex-wrap gap-1.5 min-h-[2.5rem] items-center">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((opt) => (
              <span key={opt.value} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent-blue/10 text-accent-blue">
                {opt.label}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleOption(opt.value); }}
                  className="hover:bg-accent-blue/20 rounded-full p-0.5"
                  aria-label={`Remove ${opt.label}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ))
          ) : (
            <span className="text-text-muted">{placeholder || 'Select options...'}</span>
          )}
        </div>
        <svg className={cn('absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted transition-transform', isOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-rule bg-white shadow-[0_18px_50px_rgba(4,21,34,0.16)]"
          role="listbox"
        >
          {searchable && (
            <div className="p-2 border-b border-border-default sticky top-0 bg-bg-secondary">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setFocusedIndex(-1); }}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-bg-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
                autoFocus
              />
            </div>
          )}
          
          <div className="max-h-[300px] overflow-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-muted">No options found</div>
            ) : (
              filteredOptions.map((opt, index) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={value.includes(opt.value as T)}
                  onClick={() => { toggleOption(opt.value); setSearch(''); }}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={cn(
                    'w-full px-3 py-2 text-sm text-left flex items-center gap-2',
                    value.includes(opt.value as T) ? 'bg-accent-blue/10 text-accent-blue' : 'hover:bg-bg-tertiary',
                    index === focusedIndex ? 'bg-bg-tertiary' : ''
                  )}
                >
                  <span className={cn('w-4 h-4 rounded border-2 flex-shrink-0', value.includes(opt.value as T) ? 'border-accent-blue bg-accent-blue' : 'border-border-default')}>
                    {value.includes(opt.value as T) && <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </span>
                  <div>
                    <span className="font-medium">{opt.label}</span>
                    {opt.description && <span className="text-xs text-text-muted ml-2">{opt.description}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-sm text-accent-red" role="alert">{error}</p>}
      {hint && !error && <p className="mt-1 text-sm text-text-muted">{hint}</p>}
    </div>
  );
}
