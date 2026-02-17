'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Mail,
  Inbox,
  Settings,
  BarChart3,
  Tag,
  Download,
  Menu,
  X,
  FileText,
  ClipboardList,
} from 'lucide-react'
import { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  profile: Profile
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'scout'] },
  { name: 'Artists', href: '/artists', icon: Users, roles: ['admin', 'scout'] },
  { name: 'Pipeline', href: '/pipeline', icon: Briefcase, roles: ['admin', 'scout'] },
  { name: 'Outreach', href: '/outreach', icon: Mail, roles: ['admin', 'scout'] },
  { name: 'Templates', href: '/templates', icon: FileText, roles: ['admin', 'scout'] },
  { name: 'Inbox', href: '/inbox', icon: Inbox, roles: ['admin', 'scout'] },
  { name: 'Enrichment Logs', href: '/enrichment-logs', icon: ClipboardList, roles: ['admin', 'scout'] },
  { name: 'Scraping', href: '/scraping', icon: Download, roles: ['admin'] },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['admin'] },
  { name: 'Scouts', href: '/scouts', icon: Users, roles: ['admin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin', 'scout'] },
]

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(profile.role)
  )

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold text-primary">CrateHQ</h1>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-primary">
              {profile.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex h-16 items-center border-b bg-card px-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </Button>
        <h1 className="ml-4 text-xl font-bold text-primary">CrateHQ</h1>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop always visible, Mobile slide-in */}
      <div
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r bg-card transition-transform md:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent />
      </div>
    </>
  )
}
