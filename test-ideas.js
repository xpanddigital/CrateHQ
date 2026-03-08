const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function main() {
  const systemPrompt = "VOICE & TONE: test";
  const userPrompt = `
Generate 10 high-signal carousel ideas for Instagram, returned as JSON.

Rules:
- Use ONLY these content pillars: [GENERAL].
- Avoid overlapping with these existing topics across other accounts: [NONE].
- Each idea should feel distinct and valuable, aimed at music catalog / artist business / A&R audiences.
- Vary slideCount between 5 and 9 based on the story complexity.

Return STRICT JSON:
[
  {
    "id": "string unique id",
    "type": "carousel",
    "title": "short title",
    "hook": "scroll-stopping first-slide hook",
    "category": "pillar or theme",
    "angle": "one-sentence angle description",
    "slideCount": 7
  }
]
`.trim();

  try {
    console.log("Calling anthropic...");
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    console.log("Success! Output:");
    console.log(resp.content[0].text.substring(0, 200) + "...");
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
