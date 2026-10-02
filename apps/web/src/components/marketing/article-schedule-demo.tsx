'use client';

import { useState } from 'react';
import { ScheduleDemoModal } from './schedule-demo-modal';

export function ArticleScheduleDemo() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-8 py-4 bg-transparent text-white font-bold uppercase tracking-wider border-2 border-white rounded-none hover:bg-card hover:text-ink transition-all"
      >
        Schedule Demo
      </button>
      <ScheduleDemoModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
