// Cloud fallback reader: Claude, used when the appliance fails or returns invalid stops.
import Anthropic from '@anthropic-ai/sdk';
import { SCHEMA } from './schema.mjs';

let client;

/** content: Anthropic user content blocks. Returns parsed JSON. */
export async function askClaude(content) {
  client ??= new Anthropic();
  const r = await client.messages.create({
    model: 'claude-opus-5', max_tokens: 16000,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  });
  if (r.stop_reason !== 'end_turn') throw new Error('claude stopped: ' + r.stop_reason);
  return JSON.parse(r.content.find(b => b.type === 'text').text);
}

/** Anthropic user content blocks for one input ({image} or {text}). */
export function claudeContent(input, prompt) {
  if (!input.image) return [{ type: 'text', text: prompt + input.text }];
  const [, media_type, data] = input.image.match(/^data:(image\/\w+);base64,(.*)$/s);
  return [{ type: 'image', source: { type: 'base64', media_type, data } }, { type: 'text', text: prompt }];
}
