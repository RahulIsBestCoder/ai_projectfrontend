import { http } from './http';
import { fromApi, toApi } from './case';
import { ENUM, mapEnum } from './enums';
import { rowsOf, safeRead } from './util';
import { TaigaStory } from '@/types';

/**
 * GET /v1/projects/:id/work-items — mapped into the board's story shape.
 * Tasks / issues are separate backend concepts and are not returned here.
 */
export async function listWorkItems(projectId: string) {
  return safeRead(
    async () => {
      const res = await http.get(`/projects/${projectId}/work-items`);
      const rows = rowsOf<any>(res.data);
      const stories: TaigaStory[] = rows.map((item) => ({
        id: item.id,
        projectId: item.projectId || projectId,
        sprintId: item.sprintId || '',
        subject: item.title || item.subject || '',
        storyPoints: item.storyPoints ?? 0,
        status: mapEnum(ENUM.workItemStatus.fromApi, item.status, 'BACKLOG') as any,
        assignedTo: item.assigneeName || item.assignedTo || 'Unassigned',
        type: mapEnum(ENUM.workItemType.fromApi, item.type, 'FEATURE') as any,
      }));
      return { stories, tasks: [], issues: [] };
    },
    { stories: [], tasks: [], issues: [] },
    'workItems.list'
  );
}

export async function createWorkItem(body: any) {
  const payload = toApi({
    ...body,
    status: mapEnum(ENUM.workItemStatus.toApi, body.status, body.status),
    type: mapEnum(ENUM.workItemType.toApi, body.type, body.type),
  });
  const res = await http.post('/work-items', payload);
  return fromApi(res.data);
}

export async function updateWorkItemStatus(id: string, status: string) {
  const apiStatus = mapEnum(ENUM.workItemStatus.toApi, status, status);
  const res = await http.patch(`/work-items/${id}/status`, { status: apiStatus });
  return res.data;
}

export async function updateWorkItemAssignee(id: string, assigneeId: string) {
  const res = await http.patch(`/work-items/${id}/assignee`, { assignee_id: assigneeId });
  return res.data;
}

export async function updateWorkItemPriority(id: string, priority: string) {
  const res = await http.patch(`/work-items/${id}/priority`, { priority: priority.toLowerCase() });
  return res.data;
}

export async function getWorkItemHistory(id: string) {
  return safeRead(async () => {
    const res = await http.get(`/work-items/${id}/history`);
    return rowsOf(res.data);
  }, [], 'workItems.history');
}
