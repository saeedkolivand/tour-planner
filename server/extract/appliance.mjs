// Local reader: the owner's inference appliance (llama.cpp router on :1338), Qwen3-VL-8B by default.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCHEMA } from './schema.mjs';

const URL_ = process.env.APPLIANCE_URL || 'http://127.0.0.1:1338';
const MODEL = process.env.APPLIANCE_MODEL || 'Qwen3-VL-8B-Instruct-Q4_K_M';

const token = () => process.env.APPLIANCE_KEY ||
  JSON.parse(fs.readFileSync(path.join(os.homedir(), '.appliance-token.json'), 'utf8')).token;

// A caller that brings its own `tools` gets the appliance as a transparent backend (its issue #34):
// none of the assistant's own tools (mail, web, ...) are offered or run. `noop` is never called.
const NO_TOOLS = {
  tools: [{ type: 'function', function: { name: 'noop', description: 'unused', parameters: { type: 'object', properties: {} } } }],
  tool_choice: 'none',
};

/** content: OpenAI-style user content (a string, or text + image_url parts). Returns parsed JSON. */
export async function askAppliance(content) {
  const r = await fetch(`${URL_}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token() },
    body: JSON.stringify({
      model: MODEL, stream: false, temperature: 0, ...NO_TOOLS,
      response_format: { type: 'json_schema', json_schema: { name: 'stops', schema: SCHEMA } },
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!r.ok) throw new Error(`appliance ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const text = (await r.json()).choices[0].message.content;
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

/** OpenAI-style user content for one input ({image} or {text}). */
export const applianceContent = (input, prompt) => input.image
  ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: input.image } }]
  : prompt + input.text;
