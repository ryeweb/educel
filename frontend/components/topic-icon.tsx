'use client'

import {
  Zap,
  MessageSquare,
  Crown,
  Brain,
  TrendingUp,
  Handshake,
  PenTool,
  Palette,
  DollarSign,
  Heart,
  BookOpen,
  Cpu,
  Rocket,
  Lightbulb,
  GitBranch,
  Sparkles,
  LucideIcon,
} from 'lucide-react'
import { TOPIC_ICONS } from '@/lib/types'

const iconMap: Record<string, LucideIcon> = {
  Zap,
  MessageSquare,
  Crown,
  Brain,
  TrendingUp,
  Handshake,
  PenTool,
  Palette,
  DollarSign,
  Heart,
  BookOpen,
  Cpu,
  Rocket,
  Lightbulb,
  GitBranch,
  Sparkles,
}

interface TopicIconProps {
  topic: string
  className?: string
}

export function TopicIcon({ topic, className = 'h-5 w-5' }: TopicIconProps) {
  // Find the best matching icon for the topic
  const iconName = findBestIconMatch(topic)
  const Icon = iconMap[iconName] || iconMap.Sparkles
  
  return <Icon className={className} />
}

function findBestIconMatch(topic: string): string {
  // Direct match
  if (TOPIC_ICONS[topic]) {
    return TOPIC_ICONS[topic]
  }
  
  // Check if topic contains any of the keywords
  const topicLower = topic.toLowerCase()
  
  const keywordMap: Record<string, string> = {
    'product': 'Zap',
    'efficien': 'Zap',
    'time': 'Zap',
    'communicat': 'MessageSquare',
    'speak': 'MessageSquare',
    'present': 'MessageSquare',
    'lead': 'Crown',
    'manag': 'Crown',
    'team': 'Crown',
    'psych': 'Brain',
    'mind': 'Brain',
    'think': 'Brain',
    'cognit': 'Brain',
    'sale': 'TrendingUp',
    'sell': 'TrendingUp',
    'revenue': 'TrendingUp',
    'negoti': 'Handshake',
    'deal': 'Handshake',
    'write': 'PenTool',
    'copy': 'PenTool',
    'content': 'PenTool',
    'design': 'Palette',
    'ux': 'Palette',
    'visual': 'Palette',
    'financ': 'DollarSign',
    'money': 'DollarSign',
    'invest': 'DollarSign',
    'budget': 'DollarSign',
    'health': 'Heart',
    'wellnes': 'Heart',
    'habit': 'Heart',
    'fitness': 'Heart',
    'histor': 'BookOpen',
    'learn': 'BookOpen',
    'tech': 'Cpu',
    'software': 'Cpu',
    'ai': 'Cpu',
    'code': 'Cpu',
    'career': 'Rocket',
    'job': 'Rocket',
    'promot': 'Rocket',
    'entrepren': 'Lightbulb',
    'startup': 'Lightbulb',
    'business': 'Lightbulb',
    'found': 'Lightbulb',
    'decision': 'GitBranch',
    'choice': 'GitBranch',
    'strateg': 'GitBranch',
  }
  
  for (const [keyword, icon] of Object.entries(keywordMap)) {
    if (topicLower.includes(keyword)) {
      return icon
    }
  }
  
  return 'Sparkles'
}
