'use client';

import { FolderTree } from 'lucide-react';

export default function DirectoryPage() {
  return (
    <div className="p-8 h-full flex flex-col justify-center items-center text-center">
      <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
        <FolderTree size={32} />
      </div>
      <h1 className="text-2xl font-bold mb-2">Site Directory</h1>
      <p className="text-muted-foreground max-w-md">
        Manage discovered targets, domains, and scraper profiles across all sports organizations.
      </p>
    </div>
  );
}
