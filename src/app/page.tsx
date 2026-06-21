'use client';

import { Suspense } from 'react';
import { DreamboxHome } from './DreamboxHome';

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-card" />}>
      <DreamboxHome />
    </Suspense>
  );
}
