import React from 'react';

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#0a0a0c]">
      {children}
    </div>
  );
}
