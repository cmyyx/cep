import { SidebarTrigger } from '@/components/ui/sidebar'

export default function CharacterGuidePage() {
  return (
    <div className="flex flex-col flex-1 p-6">
      <div className="flex items-center gap-2 mb-6">
        <SidebarTrigger />
        <h1 className="text-2xl font-semibold tracking-tight">Character Guide</h1>
      </div>
    </div>
  )
}
