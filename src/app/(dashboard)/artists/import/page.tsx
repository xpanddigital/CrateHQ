'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Upload, FileUp, CheckCircle, AlertCircle, Mail, Music2, Users, Loader2 } from 'lucide-react'
import { ApifyScraper } from '@/components/artists/ApifyScraper'
import {
  detectFormat,
  parseDelimitedText,
  transformSpotifyRaw,
  generatePreviewSummary,
  type ImportFormat,
  type ImportPreviewSummary,
  type TransformedArtist,
} from '@/lib/import/spotify-transformer'

interface PreviewRow {
  name: string
  email?: string
  instagram_handle?: string
  instagram_url?: string
  instagram_followers?: number
  website?: string
  spotify_url?: string
  spotify_monthly_listeners?: number
  streams_last_month?: number
  track_count?: number
  genres?: string[]
  country?: string
  facebook_url?: string
  twitter_url?: string
  tiktok_url?: string
  youtube_url?: string
  biography?: string
}

export default function ArtistsImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // New state for auto-detection
  const [detectedFormat, setDetectedFormat] = useState<ImportFormat | null>(null)
  const [spotifyPreview, setSpotifyPreview] = useState<ImportPreviewSummary | null>(null)
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [rawHeaders, setRawHeaders] = useState<string[]>([])

  const [importResult, setImportResult] = useState<{
    count: number
    updated?: number
    duplicates?: number
    bioEmailsFound?: number
    format?: string
    qualification?: { qualified: number; not_qualified: number; review: number; pending: number }
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError('')
      setSuccess(false)
      setImportResult(null)
      setDetectedFormat(null)
      setSpotifyPreview(null)
      parseFile(selectedFile)
    }
  }

  const parseNumber = (val: string): number => {
    if (!val) return 0
    return parseInt(val.replace(/,/g, '').replace(/\s/g, '')) || 0
  }

  const mapColumnToRow = (header: string, value: string, row: PreviewRow) => {
    if (!value && ![
      'monthly_listeners', 'spotify_monthly_listeners', 'spotify_monthly_listners', 'listeners', 'monthly listeners',
      'streams', 'streams_last_month', 'streams last month', 'last_month_streams', 'monthly_streams',
      'tracks', 'track_count', 'track count', 'number_of_tracks', 'total_tracks',
      'instagram_followers', 'instagram followers', 'ig_followers'
    ].includes(header)) return

    switch (header) {
      case 'name': case 'artist_name': case 'artist': row.name = value; break
      case 'email': row.email = value; break
      case 'instagram': case 'instagram_handle': case 'ig_handle': row.instagram_handle = value.replace('@', ''); break
      case 'instagram_url': case 'instagram url': case 'ig_url': row.instagram_url = value; break
      case 'instagram_followers': case 'instagram followers': case 'ig_followers': row.instagram_followers = parseNumber(value); break
      case 'website': case 'url': row.website = value; break
      case 'spotify_url': case 'spotify url': case 'spotify_link': case 'spotify link': row.spotify_url = value; break
      case 'facebook_url': case 'facebook url': case 'facebook': row.facebook_url = value; break
      case 'twitter_url': case 'twitter url': case 'twitter': case 'x_url': row.twitter_url = value; break
      case 'tiktok_url': case 'tiktok url': case 'tiktok': row.tiktok_url = value; break
      case 'youtube_url': case 'youtube url': case 'youtube': row.youtube_url = value; break
      case 'biography': case 'bio': case 'description': row.biography = value; break
      case 'monthly_listeners': case 'spotify_monthly_listeners': case 'spotify_monthly_listners':
      case 'listeners': case 'monthly listeners': row.spotify_monthly_listeners = parseNumber(value); break
      case 'streams': case 'streams_last_month': case 'streams last month':
      case 'last_month_streams': case 'monthly_streams': case 'est_streams_month': row.streams_last_month = parseNumber(value); break
      case 'tracks': case 'track_count': case 'track count': case 'number_of_tracks':
      case 'total_tracks': case 'album_count': case 'single_count': row.track_count = parseNumber(value); break
      case 'genres': case 'genre': row.genres = value.split(';').map(g => g.trim()).filter(Boolean); break
      case 'country': case 'country_name': row.country = value.toUpperCase(); break
    }
  }

  const parseFile = async (file: File) => {
    try {
      const text = await file.text()

      // Use the smart parser to detect delimiter and parse
      const { headers, rows } = parseDelimitedText(text)

      if (headers.length === 0 || rows.length === 0) {
        setError('CSV file must have at least a header row and one data row')
        return
      }

      setRawHeaders(headers)
      setRawRows(rows)

      const format = detectFormat(headers)
      setDetectedFormat(format)

      if (format === 'unknown') {
        setError('Unrecognized CSV format. Expected either raw Spotify scrape or CrateHQ format.')
        return
      }

      if (format === 'spotify_raw') {
        const summary = generatePreviewSummary(format, rows)
        setSpotifyPreview(summary)
        setPreview([])
      } else {
        // CrateHQ format — use existing parser
        setSpotifyPreview(null)
        const previewRows: PreviewRow[] = []
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row: PreviewRow = { name: '' }
          for (const [header, value] of Object.entries(rows[i])) {
            mapColumnToRow(header.toLowerCase(), value, row)
          }
          if (row.name) previewRows.push(row)
        }
        setPreview(previewRows)
      }
    } catch (err) {
      setError('Failed to parse file. Make sure it is a valid CSV or TSV.')
      console.error(err)
    }
  }

  const handleImport = async () => {
    if (!file || !detectedFormat) return

    setImporting(true)
    setError('')

    try {
      let artistsToSend: any[]

      if (detectedFormat === 'spotify_raw') {
        artistsToSend = rawRows.map(transformSpotifyRaw)
      } else {
        // CrateHQ format
        artistsToSend = []
        for (const row of rawRows) {
          const mapped: PreviewRow = { name: '' }
          for (const [header, value] of Object.entries(row)) {
            mapColumnToRow(header.toLowerCase(), value, mapped)
          }
          if (mapped.name) artistsToSend.push(mapped)
        }
      }

      const res = await fetch('/api/artists/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artists: artistsToSend, format: detectedFormat }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to import artists')
      }

      const data = await res.json()
      setImportResult({
        count: data.count,
        updated: data.updated,
        duplicates: data.duplicates,
        bioEmailsFound: data.bioEmailsFound,
        format: data.format,
        qualification: data.qualification,
      })
      setSuccess(true)
      setTimeout(() => {
        router.push('/artists')
      }, 5000)
    } catch (err: any) {
      setError(err.message || 'Failed to import artists')
    } finally {
      setImporting(false)
    }
  }

  const resetUpload = () => {
    setFile(null)
    setPreview([])
    setDetectedFormat(null)
    setSpotifyPreview(null)
    setRawRows([])
    setRawHeaders([])
    setError('')
    setSuccess(false)
    setImportResult(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Artists</h1>
        <p className="text-muted-foreground">
          Import artists from CSV or scrape from Spotify
        </p>
      </div>

      <Tabs defaultValue="csv">
        <TabsList>
          <TabsTrigger value="csv">CSV Import</TabsTrigger>
          <TabsTrigger value="scrape">Spotify Scraper</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Upload a CSV or TSV file. Auto-detects raw Spotify scrape exports and CrateHQ format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {success && importResult && (
                <div className="bg-green-500/15 text-green-500 px-4 py-3 rounded-md text-sm space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Import Complete!
                  </div>
                  <div className="pl-6 space-y-1 text-xs text-green-400/80">
                    <div>
                      New artists: <strong>{importResult.count}</strong>
                      {(importResult.updated || 0) > 0 && <> &middot; Updated: <strong>{importResult.updated}</strong></>}
                      {(importResult.duplicates || 0) > 0 && <> &middot; Duplicates merged: <strong>{importResult.duplicates}</strong></>}
                    </div>
                    {(importResult.bioEmailsFound || 0) > 0 && (
                      <div className="text-blue-400">
                        Bio emails found (free enrichment!): <strong>{importResult.bioEmailsFound}</strong>
                      </div>
                    )}
                    {importResult.qualification && (
                      <div>
                        Qualified: {importResult.qualification.qualified} &middot;
                        Not qualified: {importResult.qualification.not_qualified} &middot;
                        Review: {importResult.qualification.review}
                        {importResult.qualification.pending > 0 && ` · Pending: ${importResult.qualification.pending}`}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-green-400/60 pl-6">Redirecting to artists page...</div>
                </div>
              )}

              {/* Upload area */}
              {!detectedFormat && !success && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-12 text-center">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <Input
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={handleFileChange}
                      className="max-w-xs mx-auto"
                    />
                    <p className="text-sm text-muted-foreground mt-4">
                      Accepts CSV or TSV. Auto-detects raw Spotify scrape exports.
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 text-sm">
                    <h4 className="font-semibold mb-3">Supported Formats</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium text-xs text-muted-foreground mb-1">RAW SPOTIFY SCRAPE (Apify Play Counter)</p>
                        <p className="text-xs text-muted-foreground">
                          Direct export from the Apify Spotify Play Counter actor. Contains ~200 columns including
                          <code className="bg-background px-1 rounded mx-1">monthlyListeners</code>,
                          <code className="bg-background px-1 rounded mx-1">externalLinks/0/label</code>,
                          <code className="bg-background px-1 rounded mx-1">biography</code>.
                          Emails are automatically extracted from biographies.
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-xs text-muted-foreground mb-1">CRATEHQ FORMAT</p>
                        <p className="text-xs text-muted-foreground">
                          Standard CrateHQ columns:
                          <code className="bg-background px-1 rounded mx-1">name</code>,
                          <code className="bg-background px-1 rounded mx-1">spotify_monthly_listeners</code>,
                          <code className="bg-background px-1 rounded mx-1">track_count</code>,
                          <code className="bg-background px-1 rounded mx-1">instagram_url</code>,
                          <code className="bg-background px-1 rounded mx-1">youtube_url</code>, etc.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Spotify Raw Format Detection & Preview ── */}
              {detectedFormat === 'spotify_raw' && spotifyPreview && !success && (
                <div className="space-y-4">
                  {/* Format detection banner */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">Auto-Detected</Badge>
                      <span className="font-medium text-sm">{spotifyPreview.formatLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{spotifyPreview.totalRows.toLocaleString()}</strong> artists</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Music2 className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{spotifyPreview.hasSpotifyData.toLocaleString()}</strong> with Spotify data</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{spotifyPreview.hasSocialLinks.toLocaleString()}</strong> with social links</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-green-500" />
                        <span className="text-green-500">
                          <strong>{spotifyPreview.bioEmailsFound}</strong> bio emails found (free!)
                        </span>
                      </div>
                    </div>
                    {spotifyPreview.bioEmailArtists.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Artists with emails in bio: {spotifyPreview.bioEmailArtists.slice(0, 10).join(', ')}
                        {spotifyPreview.bioEmailArtists.length > 10 && ` + ${spotifyPreview.bioEmailArtists.length - 10} more`}
                      </div>
                    )}
                  </div>

                  {/* Preview table */}
                  <div>
                    <h3 className="font-semibold mb-2">Preview (first 10 rows)</h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Listeners</TableHead>
                            <TableHead>Top Track Streams</TableHead>
                            <TableHead>Releases</TableHead>
                            <TableHead>Bio Email</TableHead>
                            <TableHead>Instagram</TableHead>
                            <TableHead>Spotify</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {spotifyPreview.sampleRows.map((row, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {row.name}
                                {row.spotify_verified && <Badge variant="secondary" className="ml-1 text-[10px] px-1">Verified</Badge>}
                              </TableCell>
                              <TableCell>{row.spotify_monthly_listeners?.toLocaleString() || '—'}</TableCell>
                              <TableCell>{row.total_top_track_streams?.toLocaleString() || '—'}</TableCell>
                              <TableCell>{row.track_count || '—'}</TableCell>
                              <TableCell>
                                {row.email ? (
                                  <span className="text-green-500 text-xs">{row.email}</span>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.instagram_handle || '—'}
                              </TableCell>
                              <TableCell className="text-xs truncate max-w-[150px]">
                                {row.spotify_url ? 'Yes' : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Import actions */}
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Will extract: artist names, Spotify data, social links, biographies, and emails from bios.
                      Duplicates will be merged (matched by Spotify ID or name).
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={resetUpload}>Cancel</Button>
                      <Button onClick={handleImport} disabled={importing}>
                        {importing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                        ) : (
                          <><FileUp className="h-4 w-4 mr-2" /> Import {spotifyPreview.totalRows.toLocaleString()} Artists</>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CrateHQ Format Preview ── */}
              {detectedFormat === 'cratehq' && preview.length > 0 && !success && (
                <>
                  <div className="bg-muted/50 border rounded-lg p-3 flex items-center gap-2">
                    <Badge variant="secondary">Auto-Detected</Badge>
                    <span className="text-sm font-medium">CrateHQ Format</span>
                    <span className="text-sm text-muted-foreground">— {rawRows.length.toLocaleString()} artists</span>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Preview (first 10 rows)</h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Listeners</TableHead>
                            <TableHead>Streams/Mo</TableHead>
                            <TableHead>Tracks</TableHead>
                            <TableHead>Country</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Instagram</TableHead>
                            <TableHead>Genres</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.map((row, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell>{row.spotify_monthly_listeners?.toLocaleString() || '—'}</TableCell>
                              <TableCell>{row.streams_last_month?.toLocaleString() || '—'}</TableCell>
                              <TableCell>{row.track_count?.toLocaleString() || '—'}</TableCell>
                              <TableCell>{row.country || '—'}</TableCell>
                              <TableCell className="text-sm">{row.email || '—'}</TableCell>
                              <TableCell>{row.instagram_handle || '—'}</TableCell>
                              <TableCell className="text-sm">{row.genres?.join(', ') || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetUpload}>Cancel</Button>
                    <Button onClick={handleImport} disabled={importing}>
                      {importing ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                      ) : (
                        <><FileUp className="h-4 w-4 mr-2" /> Import {rawRows.length.toLocaleString()} Artists</>
                      )}
                    </Button>
                  </div>
                </>
              )}

              {/* CrateHQ format with no preview rows but detected */}
              {detectedFormat === 'cratehq' && preview.length === 0 && rawRows.length > 0 && !success && (
                <div className="space-y-4">
                  <div className="bg-muted/50 border rounded-lg p-3 flex items-center gap-2">
                    <Badge variant="secondary">Auto-Detected</Badge>
                    <span className="text-sm font-medium">CrateHQ Format</span>
                    <span className="text-sm text-muted-foreground">— {rawRows.length.toLocaleString()} rows</span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetUpload}>Cancel</Button>
                    <Button onClick={handleImport} disabled={importing}>
                      {importing ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                      ) : (
                        <><FileUp className="h-4 w-4 mr-2" /> Import {rawRows.length.toLocaleString()} Artists</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scrape">
          <ApifyScraper />
        </TabsContent>
      </Tabs>
    </div>
  )
}
