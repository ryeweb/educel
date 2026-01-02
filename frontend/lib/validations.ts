import { z } from 'zod'

// Lesson Plan validation schemas
export const LessonPlanContentSchema = z.object({
  goals: z.array(z.string().min(1).max(500)).min(2).max(10),
  resources: z.array(z.object({
    title: z.string().min(1).max(200),
    url: z.string().url().max(2000),
    type: z.enum(['article', 'video', 'book', 'course', 'tool']),
  })).min(3).max(20),
  exercises: z.array(z.string().min(1).max(1000)).min(2).max(15),
  daily_plan: z.array(z.object({
    day: z.number().int().min(1).max(365),
    focus: z.string().min(1).max(200),
    activities: z.array(z.string().min(1).max(500)).min(1).max(10),
  })).min(7).max(90),
})

export const CreateLessonPlanSchema = z.object({
  topic: z.string().min(1).max(500),
  content: LessonPlanContentSchema,
  learn_item_id: z.string().uuid().optional(),
})

// Learn Item validation schemas
export const LearnContentSchema = z.object({
  title: z.string().min(1).max(200),
  hook: z.string().min(1).max(500),
  bullets: z.array(z.string().min(1).max(200)).length(3),
  example: z.string().min(1).max(2000),
  micro_action: z.string().min(1).max(200),
  quiz_question: z.string().min(1).max(500),
  quiz_answer: z.string().min(1).max(1000),
  sources: z.array(z.object({
    title: z.string().min(1).max(200),
    url: z.string().url().max(2000),
  })).optional(),
})

export const ExpandedContentSchema = z.object({
  paragraphs: z.array(z.string().min(1).max(5000)).min(3).max(10),
  additional_bullets: z.array(z.string().min(1).max(500)).optional(),
})

export const CreateLearnItemSchema = z.object({
  topic: z.string().min(1).max(500),
  source_type: z.enum(['topic_choice', 'teach_me', 'learn_more', 'adjacent']),
  content: LearnContentSchema,
})

export const UpdateLearnItemSchema = z.object({
  id: z.string().uuid(),
  expanded_content: ExpandedContentSchema,
})

// User Preferences validation schemas
export const UpdateUserPrefsSchema = z.object({
  preferred_topics: z.array(z.string().min(1).max(100)).min(0).max(20).optional(),
  depth: z.enum(['concise', 'deeper']).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
)

// Saved Items validation schemas
export const CreateSavedItemSchema = z.object({
  item_type: z.enum(['learning', 'lesson_plan']).default('learning'),
  item_id: z.string().uuid().optional(),
  learn_item_id: z.string().uuid().optional(), // Legacy support
}).refine(
  (data) => data.item_id || data.learn_item_id,
  { message: 'Either item_id or learn_item_id must be provided' }
)
