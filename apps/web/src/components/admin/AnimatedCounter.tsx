'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring } from 'framer-motion';

export function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(0, { stiffness: 90, damping: 20 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    spring.set(value);
    const unsub = spring.on('change', (v) => setDisplay(Math.round(v)));
    return unsub;
  }, [spring, value]);

  return (
    <motion.span className={className} key={value}>
      {display}
    </motion.span>
  );
}
