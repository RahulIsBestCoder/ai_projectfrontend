import { http } from '@core/http/http';
import { unwrap } from '@core/http/util';

export interface BoardTask {
  _id: string; integration_id: string; taiga_task_id: number; ref: number; subject: string;
  taiga_milestone_id: number | null; user_story_id: number | null; user_story_ref: number | null;
  user_story_subject: string; status: number; status_name: string; status_color: string;
  is_closed: boolean; is_blocked: boolean; assigned_to_full_name?: string; assigned_to_username?: string;
  tags?: (string | string[])[]; taskboard_order?: number;
}
export interface BoardColumn { id: number; name: string; color?: string; is_closed: boolean }
export interface BoardIssue { _id:string; ref:number|null; subject:string; description?:string; status_name?:string; is_closed:boolean; assigned_to_full_name?:string; assigned_to_username?:string }
export interface BoardData { issues:BoardIssue[]; tasks: BoardTask[]; columns: BoardColumn[]; name: string }
export interface TaigaSyncResult { status: string; itemsSynced: number; message: string }

/** Pull live data from Taiga into the database (tasks, sprints, issues) for this project only. */
export async function syncTaigaData(projectId: string): Promise<TaigaSyncResult> {
  const res = await http.post(`/projects/${projectId}/sync`, { provider: 'taiga' }, { timeout: 180_000 });
  const data: any = unwrap(res) ?? {};
  return {
    status: String(data.status ?? 'success'),
    itemsSynced: Number(data.total_items_synced ?? data.totalItemsSynced ?? 0),
    message: data.status === 'partial' ? 'Taiga sync partially completed' : 'Taiga data synced',
  };
}

export async function loadTaigaBoard(projectId: string): Promise<BoardData> {
  const payload = unwrap<any>((await http.get(`/projects/${projectId}/integrations`)).data);
  const integrations = (Array.isArray(payload) ? payload : payload.rows || []).filter((i: any) => String(i.provider).toLowerCase() === 'taiga');
  if (!integrations.length) throw new Error('Connect a Taiga integration to view its sprint board.');
  // The board displays one Taiga project at a time; callers can explicitly select another integration.
  if (integrations.length > 1) throw new Error('This project has multiple Taiga integrations. Select a project with one Taiga board.');
  const integration = integrations[0];
  const tasks: BoardTask[] = [];
  let issues: BoardIssue[] = [];
  let columns: BoardColumn[] = [];
  let page = 1, pages = 1;
  do {
    const data = unwrap<any>((await http.get(`/integrations/${integration._id || integration.id}/taiga-tasks`, { params: { page, limit: 100 } })).data);
    tasks.push(...(data.rows || []));
    if (page === 1) issues = data.issues || [];
    columns = data.columns || [];
    pages = data.total_pages || 1;
    page++;
  } while (page <= pages);
  for (const task of tasks) if (!columns.some(c => c.id === task.status)) columns.push({id:task.status,name:task.status_name,color:task.status_color,is_closed:task.is_closed});
  return { tasks, issues, columns, name: integration.repository_name || integration.repositoryName || 'Taiga project' };
}
