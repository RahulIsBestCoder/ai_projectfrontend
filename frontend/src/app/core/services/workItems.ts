import { http } from '@core/http/http';
import { fromApi, toApi } from '@core/http/case';
import { ENUM, mapEnum } from '@core/http/enums';
import { rowsOf, safeRead, unwrap } from '@core/http/util';
import { listPlans } from './plans';
import { TaigaStory } from '@shared/models';

/**
 * GET /v1/projects/:id/work-items — mapped into the board's story shape.
 * Tasks / issues are separate backend concepts and are not returned here.
 */
export async function listWorkItems(projectId: string) {
  return safeRead(
    async () => {
      const raw = await http.get(`/projects/${projectId}/work-items`);
      const rows = rowsOf<any>(unwrap(raw.data));
      let stories: TaigaStory[] = rows.map((item) => {
        const sprintRef = item.sprint_id ?? item.sprintId ?? item.sprint ?? item.milestone_id ?? item.milestoneId ?? item.milestone;
        const sprintId = typeof sprintRef === 'object' && sprintRef
          ? sprintRef._id ?? sprintRef.id ?? sprintRef.value ?? ''
          : sprintRef ?? '';
        return ({
        id: String(item._id ?? item.id),
        projectId: item.projectId || projectId,
        sprintId: String(sprintId),
        subject: item.title ?? item.subject ?? '',
        storyPoints: item.story_points ?? item.storyPoints ?? 0,
        status: mapEnum(ENUM.workItemStatus.fromApi, item.status, 'BACKLOG') as any,
        assignedTo: item.assignee_id ?? item.assignedTo ?? 'Unassigned',
        type: mapEnum(ENUM.workItemType.fromApi, item.type?.toUpperCase() ?? 'FEATURE', 'FEATURE') as any,
        });
      });

      if (stories.length === 0) {
        const plans = await listPlans(projectId);
        const acceptedPlan = plans
          .filter((p) => p.status === 'accepted')
          .sort((a, b) => (b.acceptedAt || b.createdAt || '').localeCompare(a.acceptedAt || a.createdAt || ''))[0];

        if (acceptedPlan) {
          const executionRes = await http.get(`/plans/${acceptedPlan.id}/execution`);
          const dataset = unwrap<any>(executionRes.data);
          stories = (dataset?.sprints ?? []).flatMap((sprint: any) =>
            (sprint.tasks ?? []).map((task: any) => {
              const rawType = String(task.meta?.type ?? task.type ?? 'FEATURE').toUpperCase();
              const normalizedType = ['FEATURE', 'BUG', 'REFACTOR', 'TECH_DEBT'].includes(rawType)
                ? rawType
                : 'FEATURE';

              return {
                id: String(task._id ?? task.id),
                projectId: String(task.project_id ?? projectId),
                sprintId: String(sprint._id ?? sprint.id ?? ''),
                subject: String(task.title ?? task.subject ?? 'Untitled task'),
                storyPoints: Number(task.meta?.story_points ?? task.storyPoints ?? 0),
                status: task.is_completed ? 'DONE' : 'BACKLOG',
                assignedTo: String(task.meta?.assignee_role ?? task.assignee_id ?? 'Unassigned'),
                type: normalizedType as TaigaStory['type'],
              };
            })
          );
        }
      }

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
  // Backend expects a full replace via PUT
  const res = await http.put(`/work-items/${id}`, { status: apiStatus });
  return res.data;
}

export async function updateWorkItemAssignee(id: string, assigneeId: string) {
  const res = await http.put(`/work-items/${id}`, { assignee_id: assigneeId });
  return res.data;
}

export async function updateWorkItemPriority(id: string, priority: string) {
  const res = await http.put(`/work-items/${id}`, { priority: priority.toLowerCase() });
  return res.data;
}

export async function getWorkItemHistory(id: string) {
  return safeRead(async () => {
    const res = await http.get(`/work-items/${id}/history`);
    return rowsOf(res.data);
  }, [], 'workItems.history');
}
