'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import './studio.css';

const ResearchStudio = dynamic(() => import('@/components/studio/ResearchStudio'), {
  ssr: false,
});

export default function StudioPage() {
  return (
    <div className="flex-1 flex flex-col h-full w-full">
      <ResearchStudio />
    </div>
  );
}
