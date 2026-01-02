import { Info } from 'lucide-react'

export function AIDisclaimer() {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-muted text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <p>
        AI-generated content may contain errors. Please verify important information.
      </p>
    </div>
  )
}
