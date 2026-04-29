'use client';

import Link from 'next/link';
import { MonitorSmartphone } from 'lucide-react';
import { buildWebAppUrl } from '@/lib/appLinks';

type WebAppButtonProps = {
  path?: string;
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
};

export default function WebAppButton({
  path = '/auth',
  label = 'Continue on Web',
  className = '',
  variant = 'primary',
}: WebAppButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2';
  const variants = {
    primary: 'bg-slate-900 text-white shadow-lg hover:bg-slate-800 hover:shadow-xl',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50',
  };

  return (
    <Link href={buildWebAppUrl(path)} className={`${base} ${variants[variant]} ${className}`}>
      <MonitorSmartphone className="h-5 w-5" />
      {label}
    </Link>
  );
}
