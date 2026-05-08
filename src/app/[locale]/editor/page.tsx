import { SidebarTrigger } from '@/components/ui/sidebar'

export default function EditorPage() {
  return (
    <div className="flex flex-col flex-1">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">Editor</h1>
      </div>
    </div>
  )
}
