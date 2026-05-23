import { db, newId, nowIso } from '../services/local-db';
import { enqueueOperation } from '../services/sync-queue';
import type { Task } from '../types';

function normalizeTask(task: Task): Task {
  return {
    ...task,
    completed: Boolean(task.completed)
  };
}

export async function listTasksForProject(userId: string, projectId: string, includeArchived = false): Promise<Task[]> {
  const tasks = await db.tasks.where('[user_id+project_id]').equals([userId, projectId]).sortBy('created_at');
  return tasks.map(normalizeTask).filter((task) => includeArchived || !task.archived);
}

export async function listTasks(userId: string): Promise<Task[]> {
  const tasks = await db.tasks.where('user_id').equals(userId).sortBy('created_at');
  return tasks.map(normalizeTask);
}

export async function createTask(userId: string, projectId: string, name: string): Promise<Task> {
  const timestamp = nowIso();
  const task: Task = {
    id: newId(),
    user_id: userId,
    project_id: projectId,
    name,
    archived: false,
    completed: false,
    created_at: timestamp,
    updated_at: timestamp
  };

  await enqueueOperation(userId, 'task', task.id, 'create', task, () => db.tasks.put(task));
  return task;
}

export async function updateTask(userId: string, task: Task, name: string): Promise<Task> {
  const updated: Task = normalizeTask({
    ...task,
    name,
    updated_at: nowIso()
  });

  await enqueueOperation(userId, 'task', task.id, 'update', updated, () => db.tasks.put(updated));
  return updated;
}

export async function setTaskArchived(userId: string, task: Task, archived: boolean): Promise<Task> {
  const updated: Task = normalizeTask({
    ...task,
    archived,
    updated_at: nowIso()
  });

  await enqueueOperation(userId, 'task', task.id, archived ? 'archive' : 'unarchive', updated, () => db.tasks.put(updated));
  return updated;
}

export async function setTaskCompleted(userId: string, task: Task, completed: boolean): Promise<Task> {
  const updated: Task = normalizeTask({
    ...task,
    completed,
    updated_at: nowIso()
  });

  await enqueueOperation(userId, 'task', task.id, 'update', updated, () => db.tasks.put(updated));
  return updated;
}
