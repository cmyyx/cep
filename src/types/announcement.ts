export interface Announcement {
  /** Unique identifier, e.g. "announce-2026-05-09-001" */
  id: string
  title: string
  content: string
  publishTime: string
  priority: 'normal' | 'important'
}
