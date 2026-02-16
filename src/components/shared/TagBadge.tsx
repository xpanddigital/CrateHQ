import { Badge } from '@/components/ui/badge'
import { Tag } from '@/types/database'

interface TagBadgeProps {
  tag: Tag
  onRemove?: () => void
}

export function TagBadge({ tag, onRemove }: TagBadgeProps) {
  return (
    <Badge
      variant="outline"
      style={{
        borderColor: tag.color,
        color: tag.color,
        backgroundColor: `${tag.color}15`,
      }}
      className="gap-1"
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:bg-background/20 rounded-full"
        >
          ×
        </button>
      )}
    </Badge>
  )
}
