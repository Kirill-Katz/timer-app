import { db, newId, nowIso } from '../services/local-db';
import { enqueueOperation } from '../services/sync-queue';
import type { Project } from '../types';

export async function listProjects(userId: string, includeArchived = false): Promise<Project[]> {
  const projects = await db.projects.where('user_id').equals(userId).sortBy('created_at');
  return projects.filter((project) => includeArchived || !project.archived);
}

export async function createProject(userId: string, name: string, color: string): Promise<Project> {
  const timestamp = nowIso();
  const project: Project = {
    id: newId(),
    user_id: userId,
    name,
    color,
    archived: false,
    created_at: timestamp,
    updated_at: timestamp
  };

  await enqueueOperation(userId, 'project', project.id, 'create', project, () => db.projects.put(project));
  return project;
}

export async function updateProject(userId: string, project: Project, patch: Pick<Project, 'name' | 'color'>): Promise<Project> {
  const updated: Project = {
    ...project,
    ...patch,
    updated_at: nowIso()
  };

  await enqueueOperation(userId, 'project', project.id, 'update', updated, () => db.projects.put(updated));
  return updated;
}

export async function setProjectArchived(userId: string, project: Project, archived: boolean): Promise<Project> {
  const updated: Project = {
    ...project,
    archived,
    updated_at: nowIso()
  };

  await enqueueOperation(userId, 'project', project.id, archived ? 'archive' : 'unarchive', updated, () => db.projects.put(updated));
  return updated;
}
