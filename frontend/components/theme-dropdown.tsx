'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react'

interface ThemeDropdownProps {
  onThemeChange?: (theme: 'light' | 'dark' | 'auto') => void
}

export function ThemeDropdown({ onThemeChange }: ThemeDropdownProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    // Map 'system' to 'auto' for database storage
    const dbTheme = newTheme === 'system' ? 'auto' : newTheme
    onThemeChange?.(dbTheme as 'light' | 'dark' | 'auto')
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="gap-1">
        <Monitor className="h-4 w-4" />
        <ChevronDown className="h-3 w-3" />
      </Button>
    )
  }

  const currentIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />
      case 'dark':
        return <Moon className="h-4 w-4" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  const currentLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light'
      case 'dark':
        return 'Dark'
      default:
        return 'Auto'
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 px-2">
          {currentIcon()}
          <span className="hidden sm:inline text-xs">{currentLabel()}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleThemeChange('light')}>
          <Sun className="h-4 w-4 mr-2" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange('dark')}>
          <Moon className="h-4 w-4 mr-2" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange('system')}>
          <Monitor className="h-4 w-4 mr-2" />
          Auto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
