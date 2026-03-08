const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
async function main() {
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 30000,
      messages: [{ role: 'user', content: 'test' }]
    });
    console.log("Success with 30000 tokens!");
  } catch (e) {
    console.error("Error:", e);
  }
}
main();
