'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Play, CheckCircle2, AlertTriangle } from 'lucide-react'

interface IgAccountOption {
  id: string
  ig_username: string
}

interface BulkGenerateModalProps {
  isOpen: boolean
  onClose: () => void
  selectedArtistIds: string[]
  onComplete?: () => void
}

export function BulkGenerateModal({ isOpen, onClose, selectedArtistIds, onComplete }: BulkGenerateModalProps) {
  const [availableIgAccounts, setAvailableIgAccounts] = useState<IgAccountOption[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [scoutId, setScoutId] = useState<string | null>(null)
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [successCount, setSuccessCount] = useState(0)
  const [failCount, setFailCount] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  
  const { toast } = useToast()

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false)
      setProgress(0)
      setSuccessCount(0)
      setFailCount(0)
      setIsFinished(false)
      
      // Auto-select first account if not set and we have accounts
      if (availableIgAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(availableIgAccounts[0].id)
      }
    }
  }, [isOpen, availableIgAccounts, selectedAccountId])

  // Fetch initial data (Accounts and Current User)
  useEffect(() => {
    const fetchInitialData = async () => {
      const supabase = createClient()
      
      // Get User ID for scout_id
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setScoutId(session.user.id)
      }

      // Get available IG accounts
      const { data } = await supabase.from('ig_accounts').select('id, ig_username')
      if (data) {
        setAvailableIgAccounts(data)
        if (data.length > 0) {
          setSelectedAccountId(data[0].id)
        }
      }
    }
    fetchInitialData()
  }, [])

  const handleStart = async () => {
    if (!selectedAccountId) {
      toast({ title: 'Select an account', description: 'Please select an Instagram account to send from.', variant: 'destructive' })
      return
    }
    if (!scoutId) {
      toast({ title: 'Auth Error', description: 'Could not resolve your user ID. Please refresh.', variant: 'destructive' })
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setSuccessCount(0)
    setFailCount(0)
    
    const controller = new AbortController()
    setAbortController(controller)

    let successes = 0
    let failures = 0

    // Process sequentially to avoid Vercel timeouts and rate limits
    for (let i = 0; i < selectedArtistIds.length; i++) {
      if (controller.signal.aborted) {
        break
      }

      const artistId = selectedArtistIds[i]

      try {
        const res = await fetch('/api/outreach/generate-cold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artist_id: artistId,
            ig_account_id: selectedAccountId,
            scout_id: scoutId,
          }),
          signal: controller.signal
        })

        if (!res.ok) {
          // If we hit the Ramp-Up daily limit (429), abort the whole batch
          if (res.status === 429) {
             const errData = await res.json()
             toast({ 
               title: 'Daily Limit Reached', 
               description: errData.error || 'Account warm-up limit hit. Batch aborted.', 
               variant: 'destructive' 
             })
             break
          }
          throw new Error('Failed to generate')
        }
        
        successes++
        setSuccessCount(successes)
      } catch (error: any) {
        if (error.name === 'AbortError') break
        failures++
        setFailCount(failures)
      } finally {
        setProgress(i + 1)
      }
    }

    setIsProcessing(false)
    setIsFinished(true)
    setAbortController(null)
    
    if (!controller.signal.aborted) {
       toast({
         title: 'Bulk Generation Complete',
         description: `Generated ${successes} drafts. (${failures} failed).`
       })
       if (onComplete) onComplete()
    }
  }

  const handleCancel = () => {
    if (abortController) {
      abortController.abort()
      toast({ title: 'Aborted', description: 'Bulk generation stopped.' })
    }
    onClose()
  }

  const progressPercent = selectedArtistIds.length > 0 
    ? Math.round((progress / selectedArtistIds.length) * 100) 
    : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bulk Generate Cold DMs</DialogTitle>
          <DialogDescription>
            Generate personalized AI draft messages for {selectedArtistIds.length} selected artists.
          </DialogDescription>
        </DialogHeader>

        {!isProcessing && !isFinished && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sending Instagram Account</label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select IG Account" />
                </SelectTrigger>
                <SelectContent>
                  {availableIgAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      @{acc.ig_username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Drafts will be assigned to this account and placed in the Approval Queue.
              </p>
            </div>
          </div>
        )}

        {(isProcessing || isFinished) && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Progress: {progress} / {selectedArtistIds.length}</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {successCount} Generated
              </div>
              {failCount > 0 && (
                <div className="flex items-center gap-1.5 text-red-500">
                  <AlertTriangle className="h-4 w-4" />
                  {failCount} Failed
                </div>
              )}
            </div>
            
            {isProcessing && (
              <p className="text-xs text-muted-foreground flex items-center">
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                Processing sequentially to avoid server limits...
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {!isProcessing && !isFinished && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleStart} disabled={availableIgAccounts.length === 0 || selectedArtistIds.length === 0}>
                <Play className="h-4 w-4 mr-2" />
                Start Bulk Generation
              </Button>
            </>
          )}
          
          {isProcessing && (
            <Button variant="destructive" onClick={handleCancel}>
              Stop Processing
            </Button>
          )}
          
          {isFinished && (
            <Button onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
