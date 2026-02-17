/**
 * Default Email Templates
 * These templates are seeded on first load if no templates exist
 */

export interface DefaultTemplate {
  name: string
  category: string
  sequence_position: number | null
  subject: string
  body: string
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Initial Outreach - Catalog Financing',
    category: 'initial_outreach',
    sequence_position: 1,
    subject: 'Quick question about your music catalog, {{first_name}}',
    body: `Hey {{first_name}},

I came across your music and I'm impressed — {{monthly_streams}} monthly streams is no small feat.

I work with artists who are looking to unlock capital from their catalog without giving up ownership or creative control. Think of it like a non-recoupable advance against your future royalties.

Based on your current streams, you could potentially access {{estimated_value_low}} - {{estimated_value_high}} upfront.

Would you be open to a quick 15-minute call to explore if this makes sense for you?

Best,
{{sender_name}}

P.S. If you're interested, grab a time here: {{booking_link}}`,
  },
  {
    name: 'Follow-Up 1 - Gentle Nudge',
    category: 'follow_up_1',
    sequence_position: 2,
    subject: 'Re: Quick question about your music catalog',
    body: `Hey {{first_name}},

Just wanted to follow up on my last email about catalog financing.

I know you're busy, so I'll keep this short: we help artists like you ({{genres}}) access capital from their streaming royalties without selling their rights.

No strings attached — just a conversation to see if it's a fit.

Interested in chatting for 15 minutes?

Best,
{{sender_name}}`,
  },
  {
    name: 'Breakup - Door Open',
    category: 'breakup',
    sequence_position: 5,
    subject: "I'll leave you be, {{first_name}}",
    body: `Hey {{first_name}},

I haven't heard back, so I'm guessing now isn't the right time — totally understand!

I'll stop reaching out, but if you ever want to explore catalog financing down the road, my door's always open.

Wishing you continued success with your music.

Best,
{{sender_name}}

P.S. If you change your mind, you can always book a call here: {{booking_link}}`,
  },
]
