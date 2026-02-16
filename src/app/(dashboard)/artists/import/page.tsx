'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, FileUp, CheckCircle, AlertCircle } from 'lucide-react'
import { ApifyScraper } from '@/components/artists/ApifyScraper'

interface PreviewRow {
  name: string
  email?: string
  instagram_handle?: string
  instagram_followers?: number
  website?: string
  spotify_monthly_listeners?: number
  streams_last_month?: number
  track_count?: number
  genres?: string[]
  country?: string
}

export default function ArtistsImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError('')
      parseCSV(selectedFile)
    }
  }

  // Helper function to parse numbers and strip commas
  const parseNumber = (val: string): number => {
    if (!val) return 0
    return parseInt(val.replace(/,/g, '').replace(/\s/g, '')) || 0
  }

  // Map CSV column to row field
  const mapColumnToRow = (header: string, value: string, row: PreviewRow) => {
    if (!value && ![
      'monthly_listeners', 'spotify_monthly_listeners', 'spotify_monthly_listners', 'listeners', 'monthly listeners',
      'streams', 'streams_last_month', 'streams last month', 'last_month_streams', 'monthly_streams',
      'tracks', 'track_count', 'track count', 'number_of_tracks', 'total_tracks',
      'instagram_followers', 'instagram followers', 'ig_followers'
    ].includes(header)) return

    switch (header) {
      case 'name':
      case 'artist_name':
      case 'artist':
        row.name = value
        break
      case 'email':
        row.email = value
        break
      case 'instagram':
      case 'instagram_handle':
      case 'ig_handle':
        row.instagram_handle = value.replace('@', '')
        break
      case 'instagram_followers':
      case 'instagram followers':
      case 'ig_followers':
        row.instagram_followers = parseNumber(value)
        break
      case 'website':
      case 'url':
        row.website = value
        break
      case 'monthly_listeners':
      case 'spotify_monthly_listeners':
      case 'spotify_monthly_listners': // Common typo
      case 'listeners':
      case 'monthly listeners':
        row.spotify_monthly_listeners = parseNumber(value)
        break
      case 'streams':
      case 'streams_last_month':
      case 'streams last month':
      case 'last_month_streams':
      case 'monthly_streams':
        row.streams_last_month = parseNumber(value)
        break
      case 'tracks':
      case 'track_count':
      case 'track count':
      case 'number_of_tracks':
      case 'total_tracks':
        row.track_count = parseNumber(value)
        break
      case 'genres':
      case 'genre':
        row.genres = value.split(';').map(g => g.trim()).filter(Boolean)
        break
      case 'country':
      case 'country_name':
        row.country = value.toUpperCase()
        break
    }
  }

  const parseCSV = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        setError('CSV file must have at least a header row and one data row')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const rows: PreviewRow[] = []

      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const row: PreviewRow = { name: '' }

        headers.forEach((header, index) => {
          mapColumnToRow(header, values[index], row)
        })

        if (row.name) {
          rows.push(row)
        }
      }

      setPreview(rows)
    } catch (err) {
      setError('Failed to parse CSV file')
      console.error(err)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setError('')

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const artists: PreviewRow[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const row: PreviewRow = { name: '' }

        headers.forEach((header, index) => {
          mapColumnToRow(header, values[index], row)
        })

        if (row.name) {
          artists.push(row)
        }
      }

      const res = await fetch('/api/artists/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artists }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to import artists')
      }

      const data = await res.json()
      setSuccess(true)
      setTimeout(() => {
        router.push('/artists')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to import artists')
    } finally {
      setImporting(false)
    }
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
                Upload a CSV file with columns: name, email, instagram_handle, website, monthly_listeners, streams_last_month, track_count, genres, country
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-500/15 text-green-500 px-4 py-3 rounded-md text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Artists imported successfully! Redirecting...
                </div>
              )}

              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="max-w-xs mx-auto"
                />
                <p className="text-sm text-muted-foreground mt-4">
                  {file ? `Selected: ${file.name}` : 'Select a CSV file to upload'}
                </p>
              </div>

              {preview.length > 0 && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">
                      Preview (showing first 10 rows)
                    </h3>
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
                              <TableCell>
                                {row.spotify_monthly_listeners?.toLocaleString() || '—'}
                              </TableCell>
                              <TableCell>
                                {row.streams_last_month?.toLocaleString() || '—'}
                              </TableCell>
                              <TableCell>
                                {row.track_count?.toLocaleString() || '—'}
                              </TableCell>
                              <TableCell>{row.country || '—'}</TableCell>
                              <TableCell className="text-sm">{row.email || '—'}</TableCell>
                              <TableCell>{row.instagram_handle || '—'}</TableCell>
                              <TableCell className="text-sm">
                                {row.genres?.join(', ') || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFile(null)
                        setPreview([])
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={importing}>
                      <FileUp className="h-4 w-4 mr-2" />
                      {importing ? 'Importing...' : `Import ${preview.length}+ Artists`}
                    </Button>
                  </div>
                </>
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
