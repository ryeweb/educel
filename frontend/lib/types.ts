export interface LearnItem {
  id: string
  user_id: string
  topic: string
  source_type: 'topic_choice' | 'teach_me' | 'learn_more' | 'adjacent'
  content: LearnContent
  expanded_content?: ExpandedContent | null
  expanded_created_at?: string | null
  expires_at?: string | null
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
  learn_item_id?: string | null
  topic: string
  goals: string[]
  resources: ResourceItem[]
  exercises: string[]
  daily_plan: DayPlanItem[]
  created_at: string
}

// Helper type for structuring lesson plan content before saving
export interface LessonPlanContent {
  goals: string[]
  resources: ResourceItem[]
  exercises: string[]
  daily_plan: DayPlanItem[]
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
  item_type: 'learning' | 'lesson_plan'
  item_id: string
  created_at: string
  // Joined data
  learn_item?: LearnItem
  lesson_plan?: LessonPlan
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

// Curated fallback sources by category (used when Claude doesn't provide sources)
export const FALLBACK_SOURCES: Record<string, SourceLink[]> = {
  'productivity': [
    { title: 'Harvard Business Review - Productivity', url: 'https://hbr.org/topic/subject/productivity' },
    { title: 'Cal Newport - Deep Work Blog', url: 'https://calnewport.com/blog/' },
  ],
  'communication': [
    { title: 'Harvard Business Review - Communication', url: 'https://hbr.org/topic/subject/communication' },
    { title: 'Toastmasters International', url: 'https://www.toastmasters.org/resources' },
  ],
  'leadership': [
    { title: 'Harvard Business Review - Leadership', url: 'https://hbr.org/topic/subject/leadership' },
    { title: 'MIT Sloan Management Review', url: 'https://sloanreview.mit.edu/topic/leadership/' },
  ],
  'psychology': [
    { title: 'Psychology Today', url: 'https://www.psychologytoday.com/' },
    { title: 'American Psychological Association', url: 'https://www.apa.org/topics' },
  ],
  'sales': [
    { title: 'Harvard Business Review - Sales', url: 'https://hbr.org/topic/subject/sales' },
    { title: 'Gong.io Research', url: 'https://www.gong.io/resources/' },
  ],
  'negotiation': [
    { title: 'Harvard Program on Negotiation', url: 'https://www.pon.harvard.edu/daily/' },
    { title: 'Never Split the Difference Resources', url: 'https://www.blackswanltd.com/the-edge' },
  ],
  'writing': [
    { title: 'The Writing Cooperative', url: 'https://writingcooperative.com/' },
    { title: 'Purdue Online Writing Lab', url: 'https://owl.purdue.edu/' },
  ],
  'design': [
    { title: 'Nielsen Norman Group', url: 'https://www.nngroup.com/articles/' },
    { title: 'A List Apart', url: 'https://alistapart.com/' },
  ],
  'finance': [
    { title: 'Investopedia', url: 'https://www.investopedia.com/' },
    { title: 'Khan Academy Finance', url: 'https://www.khanacademy.org/economics-finance-domain' },
  ],
  'health': [
    { title: 'Harvard Health Publishing', url: 'https://www.health.harvard.edu/' },
    { title: 'Mayo Clinic', url: 'https://www.mayoclinic.org/healthy-lifestyle' },
  ],
  'history': [
    { title: 'History.com', url: 'https://www.history.com/' },
    { title: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com/history/' },
  ],
  'technology': [
    { title: 'MIT Technology Review', url: 'https://www.technologyreview.com/' },
    { title: 'Ars Technica', url: 'https://arstechnica.com/' },
  ],
  'career': [
    { title: 'Harvard Business Review - Career', url: 'https://hbr.org/topic/subject/career-planning' },
    { title: 'LinkedIn Learning Blog', url: 'https://www.linkedin.com/business/learning/blog' },
  ],
  'entrepreneurship': [
    { title: 'Y Combinator Blog', url: 'https://www.ycombinator.com/blog/' },
    { title: 'First Round Review', url: 'https://review.firstround.com/' },
  ],
  'decision': [
    { title: 'Farnam Street - Mental Models', url: 'https://fs.blog/mental-models/' },
    { title: 'LessWrong', url: 'https://www.lesswrong.com/' },
  ],
  'default': [
    { title: 'Harvard Business Review', url: 'https://hbr.org/' },
    { title: 'MIT Sloan Management Review', url: 'https://sloanreview.mit.edu/' },
  ],
}

// Enhanced topic icon mapping with keyword detection
export const TOPIC_ICON_KEYWORDS: Record<string, string[]> = {
  // Home/Real Estate
  'Home': ['mortgage', 'home', 'house', 'real estate', 'property', 'rent', 'down payment', 'housing'],
  // Finance
  'DollarSign': ['finance', 'money', 'invest', 'budget', 'saving', 'bank', 'wealth', 'stock', 'tax', 'income'],
  'Wallet': ['expense', 'spend', 'cost', 'price', 'payment'],
  // Productivity
  'Timer': ['productivity', 'time', 'efficient', 'schedule', 'deadline', 'focus', 'pomodoro'],
  'CheckSquare': ['task', 'checklist', 'todo', 'organize', 'plan', 'goal'],
  'Zap': ['quick', 'fast', 'speed', 'hack', 'shortcut'],
  // Communication
  'MessageSquare': ['communicat', 'speak', 'talk', 'conversation', 'dialogue', 'feedback'],
  'Presentation': ['present', 'pitch', 'public speaking', 'slide', 'deck'],
  'Mail': ['email', 'message', 'write', 'correspond'],
  // Leadership
  'Crown': ['lead', 'manag', 'executive', 'ceo', 'director', 'boss'],
  'Users': ['team', 'collaborate', 'group', 'people', 'staff'],
  // Psychology/Mind
  'Brain': ['psych', 'mind', 'think', 'cognit', 'mental', 'behavior', 'habit', 'bias'],
  'Heart': ['emotion', 'feel', 'empathy', 'wellness', 'health', 'stress', 'anxiety'],
  // Sales/Business
  'TrendingUp': ['sale', 'sell', 'revenue', 'growth', 'profit', 'market'],
  'Target': ['goal', 'objective', 'kpi', 'metric', 'target'],
  // Negotiation
  'Handshake': ['negoti', 'deal', 'agreement', 'contract', 'partner', 'compromise'],
  // Writing/Content
  'PenTool': ['write', 'copy', 'content', 'blog', 'article', 'draft'],
  'FileText': ['document', 'report', 'memo', 'proposal'],
  // Design
  'Palette': ['design', 'ux', 'ui', 'visual', 'creative', 'aesthetic'],
  'Layout': ['layout', 'wireframe', 'prototype', 'interface'],
  // Tech
  'Cpu': ['tech', 'software', 'ai', 'code', 'program', 'develop', 'engineer'],
  'Globe': ['web', 'internet', 'online', 'digital', 'cloud'],
  // Career
  'Rocket': ['career', 'job', 'promot', 'advancement', 'success', 'achieve'],
  'GraduationCap': ['learn', 'educat', 'train', 'skill', 'course', 'certif'],
  // Entrepreneurship
  'Lightbulb': ['entrepren', 'startup', 'founder', 'innovat', 'idea', 'venture'],
  'Building': ['business', 'company', 'organization', 'enterprise'],
  // Decision/Strategy
  'GitBranch': ['decision', 'choice', 'option', 'path', 'branch'],
  'Compass': ['strateg', 'direction', 'vision', 'mission', 'roadmap'],
  // History/Knowledge
  'BookOpen': ['histor', 'story', 'past', 'ancient', 'classic'],
  'Library': ['research', 'study', 'academic', 'scholar'],
  // Misc
  'Scale': ['balance', 'fair', 'ethics', 'moral', 'legal', 'law'],
  'Shield': ['security', 'protect', 'safe', 'risk', 'insurance'],
  'Coffee': ['break', 'rest', 'relax', 'mindful', 'meditation'],
}

// Get fallback sources for a topic
export function getFallbackSources(topic: string): SourceLink[] {
  const topicLower = topic.toLowerCase()
  
  for (const [category, sources] of Object.entries(FALLBACK_SOURCES)) {
    if (category === 'default') continue
    if (topicLower.includes(category)) {
      return sources
    }
  }
  
  // Check keywords
  const keywordMap: Record<string, string> = {
    'money': 'finance',
    'invest': 'finance', 
    'budget': 'finance',
    'team': 'leadership',
    'manage': 'leadership',
    'speak': 'communication',
    'present': 'communication',
    'habit': 'psychology',
    'mind': 'psychology',
    'startup': 'entrepreneurship',
    'founder': 'entrepreneurship',
    'ai': 'technology',
    'software': 'technology',
    'job': 'career',
    'promotion': 'career',
  }
  
  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (topicLower.includes(keyword) && FALLBACK_SOURCES[category]) {
      return FALLBACK_SOURCES[category]
    }
  }
  
  return FALLBACK_SOURCES['default']
}

// Get best icon for a topic
export function getTopicIconName(topic: string): string {
  const topicLower = topic.toLowerCase()
  
  for (const [iconName, keywords] of Object.entries(TOPIC_ICON_KEYWORDS)) {
    for (const keyword of keywords) {
      if (topicLower.includes(keyword.toLowerCase())) {
        return iconName
      }
    }
  }
  
  return 'Sparkles' // Default fallback
}

// Calculate expiration date (30 days from now)
export function calculateExpiresAt(): string {
  const date = new Date()
  date.setDate(date.getDate() + 30)
  return date.toISOString()
}
