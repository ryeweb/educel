'use client'

import {
  Home,
  Zap,
  Timer,
  CheckSquare,
  MessageSquare,
  Presentation,
  Mail,
  Crown,
  Users,
  Brain,
  Heart,
  TrendingUp,
  Target,
  Handshake,
  PenTool,
  FileText,
  Palette,
  Layout,
  DollarSign,
  Wallet,
  Cpu,
  Globe,
  Rocket,
  GraduationCap,
  Lightbulb,
  Building,
  GitBranch,
  Compass,
  BookOpen,
  Library,
  Scale,
  Shield,
  Coffee,
  Sparkles,
  LucideIcon,
} from 'lucide-react'
import { getTopicIconName } from '@/lib/types'

const iconMap: Record<string, LucideIcon> = {
  Home,
  Zap,
  Timer,
  CheckSquare,
  MessageSquare,
  Presentation,
  Mail,
  Crown,
  Users,
  Brain,
  Heart,
  TrendingUp,
  Target,
  Handshake,
  PenTool,
  FileText,
  Palette,
  Layout,
  DollarSign,
  Wallet,
  Cpu,
  Globe,
  Rocket,
  GraduationCap,
  Lightbulb,
  Building,
  GitBranch,
  Compass,
  BookOpen,
  Library,
  Scale,
  Shield,
  Coffee,
  Sparkles,
}

interface TopicIconProps {
  topic: string
  className?: string
}

export function TopicIcon({ topic, className = 'h-5 w-5' }: TopicIconProps) {
  const iconName = getTopicIconName(topic)
  const Icon = iconMap[iconName] || iconMap.Sparkles
  
  return <Icon className={className} />
}
