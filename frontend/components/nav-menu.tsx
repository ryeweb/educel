'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  Menu,
  X,
  Home,
  Bookmark,
  Settings,
  LogOut,
  User,
} from 'lucide-react'

interface NavMenuProps {
  userEmail?: string
}

export function NavMenu({ userEmail }: NavMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    setIsOpen(false)
  }

  function navigate(path: string) {
    router.push(path)
    setIsOpen(false)
  }

  return (
    <>
      {/* Hamburger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Menu */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-full bg-card border-l shadow-lg z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold text-lg">Menu</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* User Info */}
          {userEmail && (
            <div className="p-4 border-b bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userEmail}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="flex-1 p-4">
            <div className="space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12"
                onClick={() => navigate('/')}
              >
                <Home className="h-5 w-5" />
                <span>Home</span>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12"
                onClick={() => navigate('/saved')}
              >
                <Bookmark className="h-5 w-5" />
                <span>Saved</span>
              </Button>

              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-12"
                onClick={() => navigate('/settings')}
              >
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Button>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              <span>Log Out</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
