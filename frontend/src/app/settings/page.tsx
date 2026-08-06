'use client';

import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-8 h-full flex flex-col justify-center items-center text-center">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary">
        <Settings size={32} />
      </div>
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground max-w-md">
        Configure Supabase connection settings, Mapbox tokens, and scraper healing options.
      </p>
    </div>
  );
}
