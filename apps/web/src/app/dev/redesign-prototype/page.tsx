import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { FlowRedesignPrototype } from '@/components/flow/FlowRedesignPrototype';

export default function RedesignPrototypePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <FlowRedesignPrototype />
    </Suspense>
  );
}
