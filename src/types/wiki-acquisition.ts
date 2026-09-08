/** One acquisition source entry with server-resolved display text. */
export interface WikiAcquisitionSourceItem {
  name: string
  description: string
}

/** A category group of acquisition sources, ready for client rendering. */
export interface WikiAcquisitionGroup {
  categoryId: string
  label: string
  sources: WikiAcquisitionSourceItem[]
}
