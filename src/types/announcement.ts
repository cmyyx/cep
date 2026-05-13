export interface Announcement {
  /** Unique identifier, e.g. "announce-2026-05-09-001" */
  id: string
  title: string
  content: string
  publishTime: string
  priority: 'normal' | 'important'
  /** Relative path to a standalone .md file under /announcements/. When present, content is loaded from this file. */
  file?: string
}
