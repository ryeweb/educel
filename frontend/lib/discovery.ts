/**
 * Discovery & Personalization Utilities
 */

/**
 * Normalize topic string for consistent matching
 * - Trims whitespace
 * - Collapses multiple spaces to single space
 * - Converts to lowercase for case-insensitive matching
 */
export function normalizeTopic(topic: string): string {
  return topic
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * Generate a session ID for tracking user sessions
 */
export function generateSessionId(): string {
  return crypto.randomUUID()
}

/**
 * Event types for user_events table
 */
export const EVENT_TYPES = {
  RECO_SHOWN: 'reco_shown',
  TOPIC_CLICKED: 'topic_clicked',
  CONTENT_VIEWED: 'content_viewed',
  SAVED: 'saved',
  QUIZ_COMPLETED: 'quiz_completed',
  PLAN_GENERATED: 'plan_generated',
} as const

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES]

/**
 * Slot identifiers for recommendation positions
 */
export const SLOTS = {
  A: 'A', // Heavyweight - highest engagement
  B: 'B', // Related - not recently shown
  C: 'C', // Explore - random from preferences
} as const

export type Slot = typeof SLOTS[keyof typeof SLOTS]
