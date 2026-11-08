/** v2.13.0: OpenAI Responses API çağrısı — yalnız sunucudan. store:false; Structured Outputs (json_schema, strict).
 * Model adı sunucu yapılandırmasından (HPW_AI_MODEL) gelir; kodda sabit model ya da sessiz model değiştirme yok. Anahtar günlüğe yazılmaz. */
import { SYSTEM_PROMPT, OUTPUT_SCHEMA } from './prompt.js';
export type CallResult = { kind: 'ok'; json: unknown } | { kind: 'refusal'; message: string } | { kind: 'timeout' } | { kind: 'provider_error'; status: number | null; message: string } | { kind: 'invalid_output'; message: string };
export function aiRuntime() { return { model: process.env.HPW_AI_MODEL?.trim() || null, baseUrl: (process.env.HPW_AI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, ''), timeoutMs: Number(process.env.HPW_AI_TIMEOUT_MS || 90000) }; }
export async function callPlan(apiKey: string, context: unknown): Promise<CallResult> {
  const rt = aiRuntime(); if (!rt.model) return { kind: 'provider_error', status: null, message: 'model_not_configured' };
  const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), rt.timeoutMs);
  try {
    const r = await fetch(`${rt.baseUrl}/responses`, {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: rt.model, store: false, input: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify(context) }], text: { format: { type: 'json_schema', name: 'hpw_ai_action_plan', strict: true, schema: OUTPUT_SCHEMA } } }),
    });
    const body = await r.json().catch(() => null) as { status?: string; output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[]; error?: { message?: string } } | null;
    if (!r.ok || !body) return { kind: 'provider_error', status: r.status, message: body?.error?.message ? String(body.error.message).slice(0, 200) : `http ${r.status}` };
    const parts = (body.output ?? []).filter(o => o.type === 'message').flatMap(o => o.content ?? []);
    const refusal = parts.find(c => c.type === 'refusal'); if (refusal) return { kind: 'refusal', message: String(refusal.refusal ?? '').slice(0, 200) };
    if (body.status && body.status !== 'completed') return { kind: 'invalid_output', message: `yanıt durumu: ${body.status}` };
    const text = parts.find(c => c.type === 'output_text')?.text; if (!text) return { kind: 'invalid_output', message: 'çıktı metni yok' };
    try { return { kind: 'ok', json: JSON.parse(text) }; } catch { return { kind: 'invalid_output', message: 'JSON değil' }; }
  } catch (e) { return (e as Error).name === 'AbortError' ? { kind: 'timeout' } : { kind: 'provider_error', status: null, message: String((e as Error).message).slice(0, 200) }; }
  finally { clearTimeout(timer); }
}
