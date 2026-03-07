'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Sparkles, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface IgAccountOption {
  id: string
  ig_username: string
}

interface GenerateColdDmButtonProps {
  artistId: string
  availableIgAccounts: IgAccountOption[]
}

export function GenerateColdDmButton({ artistId, availableIgAccounts }: GenerateColdDmButtonProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isQueued, setIsQueued] = useState(false)
  const [scoutId, setScoutId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Automatically select the first account if there is only one
    if (availableIgAccounts.length === 1 && !selectedAccountId) {
      setSelectedAccountId(availableIgAccounts[0].id)
    }
  }, [availableIgAccounts, selectedAccountId])

  useEffect(() => {
    // Fetch the current user ID to use as the scout_id
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setScoutId(session.user.id)
      }
    }
    fetchUser()
  }, [])

  const handleGenerate = async () => {
    if (!selectedAccountId) {
      toast({
        title: 'Select an account',
        description: 'Please select an Instagram account to send the DM from.',
        variant: 'destructive',
      })
      return
    }

    if (!scoutId) {
      toast({
        title: 'Authentication Error',
        description: 'Could not find your user ID. Please refresh the page.',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch('/api/outreach/generate-cold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_id: artistId,
          ig_account_id: selectedAccountId,
          scout_id: scoutId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate and queue DM')
      }

      setIsQueued(true)
      toast({
        title: 'Message queued!',
        description: 'Message generated and queued for the DM Agent.',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  if (availableIgAccounts.length === 0) {
    return null; // Do not render if no IG accounts are available
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={isGenerating || isQueued}>
        <SelectTrigger className="w-[180px]">
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
      <Button 
        onClick={handleGenerate} 
        disabled={isGenerating || isQueued || !selectedAccountId}
        variant={isQueued ? "secondary" : "default"}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : isQueued ? (
          <>
            <Send className="h-4 w-4 mr-2" />
            Queued
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Cold DM
          </>
        )}
      </Button>
    </div>
  )
}
