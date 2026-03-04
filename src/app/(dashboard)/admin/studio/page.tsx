'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Loader2, Sparkles, Layers, ImageIcon } from 'lucide-react'

type StudioIdentity = {
  id: string
  display_name: string
  ig_account_id: string
  ig_username: string | null
}

type IdeaMode = 'carousel' | 'single'

type CarouselIdea = {
  id: string
  type: 'carousel'
  title: string
  hook: string
  category: string
  angle: string
  slideCount: number
}

type SingleIdea = {
  id: string
  type: 'single'
  title: string
  category: string
  imageSubject: string
  imageStyle: string
  captionHook: string
  captionAngle: string
}

type Idea = CarouselIdea | SingleIdea

type StudioStats = {
  carousels: number
  singles: number
}

type SinglePostDetail = {
  id: string
  nano_prompt: string | null
  alt_prompts: string[] | null
  image_url: string | null
}

export default function AdminStudioPage() {
  const [identities, setIdentities] = useState<StudioIdentity[]>([])
  const [selectedIdentityId, setSelectedIdentityId] = useState<string | null>(null)
  const [mode, setMode] = useState<IdeaMode>('carousel')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)
  const [loadingIdentities, setLoadingIdentities] = useState(true)
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [buildingPostId, setBuildingPostId] = useState<string | null>(null)
  const [stats, setStats] = useState<StudioStats>({ carousels: 0, singles: 0 })
  const [error, setError] = useState<string | null>(null)
  const [currentPost, setCurrentPost] = useState<SinglePostDetail | null>(null)
  const [imagePromptIndex, setImagePromptIndex] = useState(0)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [bulkGeneratingImages, setBulkGeneratingImages] = useState(false)

  const selectedIdentity = useMemo(
    () => identities.find((id) => id.id === selectedIdentityId) || null,
    [identities, selectedIdentityId]
  )

  useEffect(() => {
    const loadIdentities = async () => {
      try {
        setLoadingIdentities(true)
        const res = await fetch('/api/admin/identities')
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load identities')
        }
        const mapped: StudioIdentity[] = (data.identities || []).map((id: any) => ({
          id: id.id,
          display_name: id.display_name || id.ig_username || id.ig_account_id,
          ig_account_id: id.ig_account_id,
          ig_username: id.ig_username || null,
        }))
        setIdentities(mapped)
        if (mapped.length > 0) {
          setSelectedIdentityId(mapped[0].id)
        }
      } catch (e: any) {
        console.error('[Studio] Load identities error:', e)
        setError(e.message || 'Failed to load identities')
      } finally {
        setLoadingIdentities(false)
      }
    }

    loadIdentities()
  }, [])

  const loadStats = async (identityId: string) => {
    try {
      const res = await fetch(`/api/admin/studio-stats?identity_id=${identityId}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load stats')
      }
      setStats({
        carousels: data.carousels || 0,
        singles: data.singles || 0,
      })
    } catch (e: any) {
      console.error('[Studio] Stats error:', e)
    }
  }

  useEffect(() => {
    if (selectedIdentityId) {
      loadStats(selectedIdentityId)
      setIdeas([])
      setSelectedIdeaId(null)
      setCurrentPost(null)
      setImagePromptIndex(0)
    }
  }, [selectedIdentityId, mode])

  const handleGenerateIdeas = async () => {
    if (!selectedIdentityId) return
    setGeneratingIdeas(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity_id: selectedIdentityId, mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate ideas')
      }
      setIdeas(data.ideas || [])
      if (data.stats) {
        setStats({
          carousels: data.stats.carousels || 0,
          singles: data.stats.singles || 0,
        })
      }
      if ((data.ideas || []).length > 0) {
        setSelectedIdeaId(data.ideas[0].id)
      }
    } catch (e: any) {
      console.error('[Studio] Generate ideas error:', e)
      setError(e.message || 'Failed to generate ideas')
    } finally {
      setGeneratingIdeas(false)
    }
  }

  const handleBuildPost = async (idea: Idea) => {
    if (!selectedIdentityId) return
    setBuildingPostId(idea.id)
    setError(null)
    try {
      const res = await fetch('/api/admin/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity_id: selectedIdentityId, mode, idea }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to build post')
      }
      // Refresh stats after build
      await loadStats(selectedIdentityId)

      if (mode === 'single' && data.post) {
        setCurrentPost({
          id: data.post.id,
          nano_prompt: data.post.nano_prompt,
          alt_prompts: data.post.alt_prompts || [],
          image_url: data.post.image_url || null,
        })
        setImagePromptIndex(0)
      }
    } catch (e: any) {
      console.error('[Studio] Generate post error:', e)
      setError(e.message || 'Failed to build post')
    } finally {
      setBuildingPostId(null)
    }
  }

  const selectedIdea = useMemo(
    () => ideas.find((i) => i.id === selectedIdeaId) || null,
    [ideas, selectedIdeaId]
  )

  const currentImagePrompt = useMemo(() => {
    if (!currentPost) return ''
    const prompts = [
      currentPost.nano_prompt,
      ...(currentPost.alt_prompts || []),
    ].filter(Boolean) as string[]
    if (!prompts.length) return ''
    const idx = Math.min(Math.max(imagePromptIndex, 0), prompts.length - 1)
    return prompts[idx]
  }, [currentPost, imagePromptIndex])

  const handleGenerateImage = async () => {
    if (!currentPost) return
    const prompt = currentImagePrompt
    if (!prompt) {
      setError('No image prompt available for this post.')
      return
    }
    if (!selectedIdentity) return

    setGeneratingImage(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          postId: currentPost.id,
          igAccountId: selectedIdentity.ig_account_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate image')
      }
      setCurrentPost((prev) =>
        prev ? { ...prev, image_url: data.imageUrl || prev.image_url } : prev
      )
    } catch (e: any) {
      console.error('[Studio] Generate image error:', e)
      setError(e.message || 'Failed to generate image')
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleGenerateAllImages = async () => {
    if (!selectedIdentity || mode !== 'single') return
    setBulkGeneratingImages(true)
    setError(null)
    try {
      // Fetch all single-image posts for this identity without image_url
      const res = await fetch(
        `/api/admin/studio-single-posts?identity_id=${selectedIdentity.id}`
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load posts needing images')
      }
      const posts: SinglePostDetail[] = data.posts || []
      for (const post of posts) {
        const prompts = [
          post.nano_prompt,
          ...(post.alt_prompts || []),
        ].filter(Boolean) as string[]
        if (!prompts.length) continue

        const prompt = prompts[0]
        try {
          const resImg = await fetch('/api/admin/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              postId: post.id,
              igAccountId: selectedIdentity.ig_account_id,
            }),
          })
          // consume body for logging, but ignore per-post failures
          const d = await resImg.json()
          if (!resImg.ok) {
            console.error('[Studio] Bulk generate image error:', d.error)
          }
        } catch (e) {
          console.error('[Studio] Bulk generate image exception:', e)
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } catch (e: any) {
      console.error('[Studio] Bulk image error:', e)
      setError(e.message || 'Failed to generate images')
    } finally {
      setBulkGeneratingImages(false)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-[0.12em]">
              Account
            </span>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[200px]"
              value={selectedIdentityId || ''}
              onChange={(e) => setSelectedIdentityId(e.target.value || null)}
            >
              {identities.map((id) => (
                <option key={id.id} value={id.id}>
                  {id.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn('px-2 py-1 rounded-full border text-[11px] cursor-pointer', mode === 'carousel' && 'bg-primary text-primary-foreground border-primary')}
              onClick={() => setMode('carousel')}
            >
              Carousels
            </span>
            <span className={cn('px-2 py-1 rounded-full border text-[11px] cursor-pointer', mode === 'single' && 'bg-primary text-primary-foreground border-primary')}
              onClick={() => setMode('single')}
            >
              Single Image
            </span>
            <span className="ml-3 text-[11px]">
              {stats.carousels} carousels · {stats.singles} singles built
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-red-400 max-w-xs truncate">{error}</span>
          )}
          {mode === 'single' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateAllImages}
              disabled={bulkGeneratingImages || !selectedIdentity}
            >
              {bulkGeneratingImages ? 'Generating all…' : 'Generate All Images'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleGenerateIdeas}
            disabled={generatingIdeas || !selectedIdentityId}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {generatingIdeas ? 'Generating…' : 'Generate 10 Ideas'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Left panel: ideas */}
        <Card className="lg:w-1/2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {mode === 'carousel' ? (
                <>
                  <Layers className="h-4 w-4" />
                  Carousel Ideas
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4" />
                  Single Image Ideas
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingIdentities && !ideas.length ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading…
              </div>
            ) : ideas.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No ideas yet. Click &quot;Generate 10 Ideas&quot; to get started.
              </div>
            ) : (
              ideas.map((idea) => (
                <div
                  key={idea.id}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-sm cursor-pointer flex items-start gap-3',
                    selectedIdeaId === idea.id && 'border-primary bg-primary/5'
                  )}
                  onClick={() => setSelectedIdeaId(idea.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{idea.title}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {idea.type === 'carousel' ? 'Carousel' : 'Single'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {idea.type === 'carousel' ? (idea as CarouselIdea).hook : (idea as SingleIdea).captionHook}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {idea.category}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBuildPost(idea)
                    }}
                    disabled={buildingPostId === idea.id}
                  >
                    {buildingPostId === idea.id ? 'Building…' : 'Build'}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right panel: expanded detail */}
        <Card className="lg:w-1/2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {selectedIdea ? selectedIdea.title : 'Post Detail'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!selectedIdea ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Select an idea on the left to see details.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">
                    {selectedIdea.type === 'carousel' ? 'Carousel' : 'Single Image'}
                  </Badge>
                  <span>·</span>
                  <span>{selectedIdea.category}</span>
                  {selectedIdea.type === 'carousel' && (
                    <>
                      <span>·</span>
                      <span>{(selectedIdea as CarouselIdea).slideCount} slides</span>
                    </>
                  )}
                </div>

                {selectedIdea.type === 'carousel' ? (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold">Hook</h3>
                    <p className="text-sm">
                      {(selectedIdea as CarouselIdea).hook}
                    </p>
                    <h3 className="text-xs font-semibold mt-3">Angle</h3>
                    <p className="text-sm">
                      {(selectedIdea as CarouselIdea).angle}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-semibold">Image</h3>
                      <p className="text-xs text-muted-foreground">
                        Style: {(selectedIdea as SingleIdea).imageStyle} · Subject:{' '}
                        {(selectedIdea as SingleIdea).imageSubject}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-xs font-semibold">Hook</h3>
                      <p className="text-sm">
                        {(selectedIdea as SingleIdea).captionHook}
                      </p>
                      <h3 className="text-xs font-semibold mt-3">Angle</h3>
                      <p className="text-sm">
                        {(selectedIdea as SingleIdea).captionAngle}
                      </p>
                    </div>

                    {currentPost && (
                      <div className="space-y-3 pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold">Image Generation</h3>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span>Prompt</span>
                            <select
                              className="h-7 rounded-md border border-input bg-background px-1.5 text-[11px]"
                              value={imagePromptIndex}
                              onChange={(e) =>
                                setImagePromptIndex(Number(e.target.value) || 0)
                              }
                            >
                              <option value={0}>Primary</option>
                              {currentPost.alt_prompts &&
                                currentPost.alt_prompts.map((_, idx) => (
                                  <option key={idx + 1} value={idx + 1}>
                                    Alt {idx + 1}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground break-words">
                          {currentImagePrompt || 'No prompt available yet.'}
                        </p>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleGenerateImage}
                            disabled={generatingImage || !currentImagePrompt}
                          >
                            {generatingImage ? 'Generating…' : 'Generate Image'}
                          </Button>
                          {currentPost.image_url && (
                            <span className="text-[11px] text-muted-foreground">
                              Image generated
                            </span>
                          )}
                        </div>

                        {currentPost.image_url && (
                          <div className="mt-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={currentPost.image_url}
                              alt="Generated content"
                              className="w-full max-w-sm rounded-lg border border-border bg-black/20"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

