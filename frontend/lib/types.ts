export interface LearnItem {
  id: string
  user_id: string
  topic: string
  source_type: 'topic_choice' | 'teach_me' | 'learn_more' | 'adjacent'
  content: LearnContent
  created_at: string
}

export interface LearnContent {
  title: string
  hook: string
  bullets: string[]
  example: string
  micro_action: string
  quiz_question: string
  quiz_answer: string
  sources?: SourceLink[]
}

export interface SourceLink {
  title: string
  url: string
}

export interface ExpandedContent {
  paragraphs: string[]
  additional_bullets?: string[]
}

export interface LessonPlan {
  id: string
  user_id: string
  learn_item_id: string
  topic: string
  goals: string[]
  resources: ResourceItem[]
  exercises: string[]
  daily_plan: DayPlanItem[]
  created_at: string
}

export interface ResourceItem {
  title: string
  url: string
  type: 'article' | 'video' | 'book' | 'course' | 'tool'
}

export interface DayPlanItem {
  day: number
  focus: string
  activities: string[]
}

export interface UserPrefs {
  user_id: string
  preferred_topics: string[]
  depth: 'concise' | 'deeper'
  theme: 'light' | 'dark' | 'auto'
  created_at: string
  updated_at: string
}

export interface SavedItem {
  id: string
  user_id: string
  learn_item_id: string
  created_at: string
  learn_item?: LearnItem
}

export interface TopicOption {
  topic: string
  hook: string
  icon?: string
}

export interface ClarifyResponse {
  question: string
  options: string[]
}

export type GenerateType = 
  | 'topic_options'
  | 'learn_item'
  | 'learn_more'
  | 'expand_content'
  | 'lesson_plan'
  | 'adjacent_options'
  | 'clarify_topic'

export interface GenerateRequest {
  type: GenerateType
  preferred_topics: string[]
  depth: 'concise' | 'deeper'
  topic?: string
  custom_topic?: string
  prior_item?: LearnContent
}

export const CURATED_TOPICS = [
  'Productivity',
  'Communication',
  'Leadership',
  'Psychology',
  'Sales',
  'Negotiation',
  'Writing',
  'Design',
  'Finance basics',
  'Health habits',
  'History',
  'Technology',
  'Career growth',
  'Entrepreneurship',
  'Decision-making',
] as const

export const ROTATING_HEADLINES = [
  'What would you like to learn?',
  'How about a new topic today?',
  'Quick win or deeper dive?',
  'Pick your next insight',
  'Learn something in 60 seconds',
  'Ready for a fresh perspective?',
] as const

// Map topics to lucide icon names
export const TOPIC_ICONS: Record<string, string> = {
  'Productivity': 'Zap',
  'Communication': 'MessageSquare',
  'Leadership': 'Crown',
  'Psychology': 'Brain',
  'Sales': 'TrendingUp',
  'Negotiation': 'Handshake',
  'Writing': 'PenTool',
  'Design': 'Palette',
  'Finance basics': 'DollarSign',
  'Health habits': 'Heart',
  'History': 'BookOpen',
  'Technology': 'Cpu',
  'Career growth': 'Rocket',
  'Entrepreneurship': 'Lightbulb',
  'Decision-making': 'GitBranch',
  // Default fallback
  'default': 'Sparkles',
}
