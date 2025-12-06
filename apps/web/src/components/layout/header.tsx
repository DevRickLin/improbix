'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, History, ListTodo, Bug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from './theme-toggle';
import { useAuthStore } from '@/stores/auth-store';

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
            <span className="font-bold text-xl">Improbix</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/dashboard"
              className="flex items-center transition-colors hover:text-foreground/80 text-foreground/60"
            >
              <ListTodo className="mr-1 h-4 w-4" />
              Tasks
            </Link>
            <Link
              href="/dashboard/history"
              className="flex items-center transition-colors hover:text-foreground/80 text-foreground/60"
            >
              <History className="mr-1 h-4 w-4" />
              History
            </Link>
            <Link
              href="/dashboard/debug"
              className="flex items-center transition-colors hover:text-foreground/80 text-foreground/60"
            >
              <Bug className="mr-1 h-4 w-4" />
              Debug
            </Link>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 px-3">
                <span className="text-sm">{user?.username || 'User'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuItem className="flex-col items-start">
                <div className="text-xs text-muted-foreground">Signed in as</div>
                <div className="text-sm font-medium">{user?.username}</div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
