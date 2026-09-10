import { http } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, safeRead } from './util';
import { AIProviderConfig, AIProviderName, SprintPlan } from '@/types';
import { listPlans } from './plans';
import { getAcceptedPlan } from '../acceptedPlan';

const PROVIDER_NAME_MAP: Record<string, AIProviderName> = {
  gemini: 'GEMINI',
  openai: 'OPENAI',
  anthropic: 'CLAUDE',
  claude: 'CLAUDE',
  deepseek: 'DEEPSEEK',
  ollama: 'OLLAMA',
};

export interface AiChatResponse {
  conversationId: string | null;
  intent: 'metric_lookup' | 'explanation' | 'recommendation' | 'freeform' | string;
  answer: string;
  /** Back-compat alias for `answer` (older screens read `.response`). */
  response: string;
  citations: { metric: string; value: number | string }[];
}

export async function getAiModels(): Promise<{ name: string; provider: string }[]> {
  return safeRead(async () => {
    const res = await http.get('/ai/models');
    return rowsOf(res.data);
  }, [], 'ai.models');
}

/**
 * `GET /v1/ai/providers` returns `[{ name: "gemini" }, ...]`. Reshape into the
 * `AIProviderConfig` the settings UI renders, folding in a model name from
 * `GET /v1/ai/models` where available. Marks the first provider active.
 */
export async function getAIProviders(): Promise<AIProviderConfig[]> {
  return safeRead(
    async () => {
      const [provRes, models] = await Promise.all([http.get('/ai/providers'), getAiModels()]);
      const raw = rowsOf<any>(provRes.data);
      return raw
        .map((p, i) => {
          const key = String(p.name || p.provider || '').toLowerCase();
          const provider = PROVIDER_NAME_MAP[key];
          if (!provider) return null;
          const model = models.find((m) => m.provider?.toLowerCase() === key);
          return {
            provider,
            modelName: p.model || model?.name || key,
            active: i === 0,
            apiKeySet: true,
          } as AIProviderConfig;
        })
        .filter((x): x is AIProviderConfig => x !== null);
    },
    [],
    'ai.providers'
  );
}

/**
 * There is no route to set the active provider server-side. This is a
 * client-only selection; the caller updates local state.
 */
export async function updateAIProvider(_providerName: string, _config: Partial<AIProviderConfig>) {
  return { acknowledged: true, clientOnly: true };
}

/**
 * POST /v1/ai/chat — the backend takes `{ prompt, project_id? }` (NOT `message`)
 * and replies `dataset = { response: "<string>" }`. There is no conversation id,
 * intent, or citations. When `project_id` is set the model is prompted for a
 * JSON summary, so the string may contain a ```json block — `humaniseAiAnswer`
 * unwraps it.
 */
/**
 * Build a compact text block from the project's plan (the accepted/edited plan in
 * local storage if present, otherwise the newest saved plan from
 * `GET /v1/plans?project_id=`). Returns '' when there is no plan.
 */
export async function planContextBlock(projectId: string): Promise<string> {
  return safeRead(
    async () => {
      const saved = await listPlans(projectId);
      saved.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const latest = saved[0];
      const accepted = getAcceptedPlan(projectId);
      const plan: SprintPlan | undefined = accepted?.plan || latest?.plan;
      if (!plan) return '';

      const input = latest?.input;
      const lines: string[] = ['## Approved Plan (source of truth for team & schedule)'];

      const meta: string[] = [];
      if (input?.teamSize != null) meta.push(`Team size: ${input.teamSize} people`);
      if (input?.durationWeeks != null) meta.push(`Duration: ${input.durationWeeks} weeks`);
      if (input?.sprintLengthWeeks != null) meta.push(`Sprint length: ${input.sprintLengthWeeks} weeks`);
      if (input?.startDate) meta.push(`Start: ${input.startDate}`);
      if (meta.length) lines.push(`- ${meta.join(' · ')}`);
      if (accepted) lines.push(`- Plan status: accepted (${accepted.source === 'ai' ? 'AI + edits' : 'manual'})`);
      if (plan.summary) lines.push(`- Summary: ${plan.summary}`);

      if (plan.sprints?.length) {
        lines.push(`- Sprints (${plan.sprints.length}):`);
        plan.sprints.slice(0, 10).forEach((s) => {
          const range = [s.startDate, s.endDate].filter(Boolean).join(' → ');
          const tasks = s.tasks?.length ? `, ${s.tasks.length} tasks` : '';
          lines.push(`  - ${s.name}${range ? ` (${range})` : ''}${s.goal ? ` — ${s.goal}` : ''}${tasks}`);
        });
      }
      if (plan.milestones?.length) {
        lines.push(
          `- Milestones: ${plan.milestones
            .slice(0, 6)
            .map((m) => `${m.name}${m.date ? ` (${m.date})` : ''}`)
            .join('; ')}`
        );
      }
      if (plan.deadlines?.length) {
        lines.push(
          `- Deadlines: ${plan.deadlines
            .slice(0, 6)
            .map((x) => `${x.label}${x.date ? ` (${x.date})` : ''}`)
            .join('; ')}`
        );
      }
      if (plan.assumptions?.length) {
        lines.push(`- Assumptions: ${plan.assumptions.slice(0, 5).join('; ')}`);
      }
      return lines.join('\n');
    },
    '',
    'ai.planContext'
  );
}

export async function askAiAssistant(
  prompt: string,
  projectId?: string,
  _conversationId?: string | null
): Promise<AiChatResponse> {
  // The backend's project context only covers analytics + risks — it never sees
  // the sprint plan. Inline the approved/latest plan so questions about team
  // size, sprints, milestones and deadlines can actually be answered.
  const planBlock = projectId ? await planContextBlock(projectId) : '';
  const finalPrompt = planBlock ? `${planBlock}\n\n${prompt}` : prompt;

  const res = await http.post('/ai/chat', toApi({ prompt: finalPrompt, projectId: projectId || undefined }));
  const d = fromApi(res.data);
  const raw = (d.response ?? d.answer ?? '').toString();
  const answer = humaniseAiAnswer(raw);
  return {
    conversationId: null,
    intent: 'freeform',
    answer,
    response: answer,
    citations: [],
  };
}

/** The chat reply is sometimes a ```json {summary, insights[...]} blob — surface something readable. */
function humaniseAiAnswer(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = (fenced ? fenced[1] : trimmed).trim();
  if (body.startsWith('{') || body.startsWith('[')) {
    try {
      const obj = JSON.parse(body);
      const parts: string[] = [];
      if (obj.summary) parts.push(String(obj.summary));
      if (Array.isArray(obj.insights) && obj.insights.length) {
        parts.push(
          obj.insights
            .slice(0, 5)
            .map((i: any) => `• ${i.title || i.description || ''}`.trim())
            .filter((s: string) => s !== '•')
            .join('\n')
        );
      }
      if (Array.isArray(obj.recommendations) && obj.recommendations.length) {
        parts.push(
          'Recommendations:\n' +
            obj.recommendations
              .slice(0, 5)
              .map((r: any) => `• ${typeof r === 'string' ? r : r.text || r.title || ''}`)
              .join('\n')
        );
      }
      const joined = parts.filter(Boolean).join('\n\n').trim();
      if (joined) return joined;
    } catch {
      /* not valid JSON — fall through to the raw text */
    }
  }
  return trimmed;
}

export async function getProjectAiSummary(projectId: string): Promise<string> {
  return safeRead(async () => {
    const res = await http.post(`/projects/${projectId}/ai/summary`, {});
    const d = fromApi(res.data);
    return d.summaryText || d.summary_text || d.summary || '';
  }, '', 'ai.summary');
}

export async function getProjectRecommendations(
  projectId: string
): Promise<{ text: string; priority: string }[]> {
  return safeRead(async () => {
    const res = await http.post(`/projects/${projectId}/ai/recommendations`, {});
    const d = fromApi(res.data);
    return Array.isArray(d.items) ? d.items : [];
  }, [], 'ai.recommendations');
}
