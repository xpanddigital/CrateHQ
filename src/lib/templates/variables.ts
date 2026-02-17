/**
 * Email Template Variables
 * Variables that can be used in email templates
 */

export interface TemplateVariable {
  key: string
  label: string
  description: string
  example: string
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    key: 'artist_name',
    label: 'Artist Name',
    description: "The artist's full name",
    example: 'John Doe',
  },
  {
    key: 'first_name',
    label: 'First Name',
    description: "The artist's first name",
    example: 'John',
  },
  {
    key: 'monthly_streams',
    label: 'Monthly Streams',
    description: 'Formatted monthly stream count',
    example: '1,234,567',
  },
  {
    key: 'track_count',
    label: 'Track Count',
    description: 'Number of tracks released',
    example: '42',
  },
  {
    key: 'genres',
    label: 'Genres',
    description: 'Comma-separated list of genres',
    example: 'Pop, Rock, Indie',
  },
  {
    key: 'estimated_value_low',
    label: 'Estimated Value (Low)',
    description: 'Lower bound of catalog valuation',
    example: '$15K',
  },
  {
    key: 'estimated_value_high',
    label: 'Estimated Value (High)',
    description: 'Upper bound of catalog valuation',
    example: '$25K',
  },
  {
    key: 'sender_name',
    label: 'Sender Name',
    description: 'Your full name',
    example: 'Sarah Johnson',
  },
  {
    key: 'booking_link',
    label: 'Booking Link',
    description: 'Your Calendly or scheduling link',
    example: 'https://calendly.com/sarah/15min',
  },
]

export const SAMPLE_DATA: Record<string, string> = {
  artist_name: 'Alex Rivers',
  first_name: 'Alex',
  monthly_streams: '2,450,000',
  track_count: '38',
  genres: 'Electronic, House, Dance',
  estimated_value_low: '$18K',
  estimated_value_high: '$32K',
  sender_name: 'Sarah Johnson',
  booking_link: 'https://calendly.com/sarah/15min',
}

/**
 * Replace template variables with actual data
 */
export function replaceVariables(
  text: string,
  data: Record<string, string> = SAMPLE_DATA
): string {
  let result = text
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, value || '')
  })
  return result
}

/**
 * Get all variables used in a template
 */
export function extractVariables(text: string): string[] {
  const regex = /{{\\s*([a-z_]+)\\s*}}/g
  const matches = text.matchAll(regex)
  return Array.from(matches, (m) => m[1])
}
