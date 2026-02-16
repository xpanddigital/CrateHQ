import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Deal } from '@/types/database'
import { formatCurrency, getDaysSince } from '@/lib/utils'

interface DealCardProps {
  deal: Deal
}

export function DealCard({ deal }: DealCardProps) {
  const daysInStage = getDaysSince(deal.stage_changed_at)

  return (
    <Link href={`/pipeline/${deal.id}`}>
      <Card className="cursor-pointer hover:border-primary transition-colors">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="font-semibold text-sm mb-1">
              {deal.artist?.name || 'Unknown Artist'}
            </p>
            {deal.estimated_deal_value && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(deal.estimated_deal_value)}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {deal.scout && (
                <div className="flex items-center gap-1">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-primary">
                      {deal.scout.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {deal.scout.full_name.split(' ')[0]}
                  </span>
                </div>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {daysInStage}d
            </Badge>
          </div>

          {deal.artist?.genres && deal.artist.genres.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {deal.artist.genres.slice(0, 2).map((genre) => (
                <Badge key={genre} variant="secondary" className="text-xs">
                  {genre}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
