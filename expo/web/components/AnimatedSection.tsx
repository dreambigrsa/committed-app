'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
};

/**
 * Lightweight scroll-reveal using Intersection Observer + CSS.
 * Replaces Framer Motion for simple fade/slide to reduce bundle and hydration cost.
 */
export function AnimatedSection({ children, className = '', delay = 0, once = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.05, rootMargin: '-80px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const show = reducedMotion || visible;
  const transitionDelay = show ? `${delay}ms` : '0ms';

  return (
    <div
      ref={ref}
      className={`${className} ${show ? 'animate-section-visible' : 'animate-section-hidden'}`}
      style={{ transitionDelay } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/* Stagger components still use Framer Motion (complex stagger logic, used in HowItWorksStepper only) */
export function StaggerContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={
        reduced
          ? { hidden: {}, visible: {} }
          : {
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.08, delayChildren: 0.1 },
              },
            }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      variants={
        reduced
          ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
          : { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
      }
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
