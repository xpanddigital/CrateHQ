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
  transformCrateHQ,
  generatePreviewSummary,
  type ImportFormat,
  type ImportPreviewSummary,
  type TransformedArtist,
} from '@/lib/import/spotify-transformer'

export default function ArtistsImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [detectedFormat, setDetectedFormat] = useState<ImportFormat | null>(null)
  const [previewSummary, setPreviewSummary] = useState<ImportPreviewSummary | null>(null)
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])

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
      setPreviewSummary(null)
      parseFile(selectedFile)
    }
  }

  const parseFile = async (file: File) => {
    try {
      const text = await file.text()
      const { headers, rows } = parseDelimitedText(text)

      if (headers.length === 0 || rows.length === 0) {
        setError('CSV file must have at least a header row and one data row')
        return
      }

      setRawRows(rows)

      const format = detectFormat(headers)
      setDetectedFormat(format)

      if (format === 'unknown') {
        setError('Unrecognized CSV format. Expected either raw Spotify scrape or CrateHQ format.')
        return
      }

      const summary = generatePreviewSummary(format, rows)
      setPreviewSummary(summary)
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
        artistsToSend = rawRows.map(transformSpotifyRaw).filter(a => a.name)
      } else {
        artistsToSend = rawRows.map(transformCrateHQ).filter(a => a.name)
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
    setDetectedFormat(null)
    setPreviewSummary(null)
    setRawRows([])
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

              {/* ── Unified Preview (both formats) ── */}
              {detectedFormat && previewSummary && !success && (
                <div className="space-y-4">
                  {/* Format detection banner */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">Auto-Detected</Badge>
                      <span className="font-medium text-sm">{previewSummary.formatLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{previewSummary.totalRows.toLocaleString()}</strong> artists</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Music2 className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{previewSummary.hasSpotifyData.toLocaleString()}</strong> with Spotify data</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span><strong>{previewSummary.hasSocialLinks.toLocaleString()}</strong> with social links</span>
                      </div>
                      {previewSummary.bioEmailsFound > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-green-500" />
                          <span className="text-green-500">
                            <strong>{previewSummary.bioEmailsFound}</strong> bio emails found (free!)
                          </span>
                        </div>
                      )}
                    </div>
                    {previewSummary.bioEmailArtists.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Artists with emails in bio: {previewSummary.bioEmailArtists.slice(0, 10).join(', ')}
                        {previewSummary.bioEmailArtists.length > 10 && ` + ${previewSummary.bioEmailArtists.length - 10} more`}
                      </div>
                    )}
                  </div>

                  {/* Preview table */}
                  {previewSummary.sampleRows.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Preview (first 10 rows)</h3>
                      <div className="border rounded-lg overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Listeners</TableHead>
                              <TableHead>Streams</TableHead>
                              <TableHead>Tracks</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Instagram</TableHead>
                              <TableHead>Country</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewSummary.sampleRows.map((row, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium">
                                  {row.name}
                                  {row.spotify_verified && <Badge variant="secondary" className="ml-1 text-[10px] px-1">Verified</Badge>}
                                </TableCell>
                                <TableCell>{row.spotify_monthly_listeners?.toLocaleString() || '—'}</TableCell>
                                <TableCell>{row.streams_last_month?.toLocaleString() || '—'}</TableCell>
                                <TableCell>{row.track_count || '—'}</TableCell>
                                <TableCell>
                                  {row.email ? (
                                    <span className="text-green-500 text-xs">{row.email}</span>
                                  ) : '—'}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.instagram_handle || '—'}
                                </TableCell>
                                <TableCell>{row.country || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Import actions */}
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Duplicates will be merged (matched by Spotify ID or name).
                      {previewSummary.bioEmailsFound > 0 && ' Emails from biographies will be extracted automatically.'}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={resetUpload}>Cancel</Button>
                      <Button onClick={handleImport} disabled={importing}>
                        {importing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                        ) : (
                          <><FileUp className="h-4 w-4 mr-2" /> Import {previewSummary.totalRows.toLocaleString()} Artists</>
                        )}
                      </Button>
                    </div>
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
