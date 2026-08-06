'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderTree, Code2, CheckSquare, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/directory', label: 'Site Directory', icon: FolderTree },
  { href: '/studio', label: 'Scraper Studio', icon: Code2 },
  { href: '/qa', label: 'Data QA', icon: CheckSquare },
];

export default function GlobalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-card border-r border-border h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-serif text-primary font-bold italic tracking-wider">
          ScraperOps
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>
    </aside>
  );
}
