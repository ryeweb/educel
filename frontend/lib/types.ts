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
}

export interface UserPrefs {
  user_id: string
  preferred_topics: string[]
  depth: 'concise' | 'deeper'
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
}

export interface ClarifyResponse {
  question: string
  options: string[]
}

export type GenerateType = 
  | 'topic_options'
  | 'learn_item'
  | 'learn_more'
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
