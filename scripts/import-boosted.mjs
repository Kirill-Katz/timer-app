import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function main() {
  loadDotEnv(path.join(repoRoot, '.env.local'));

  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.userId) {
    throw new Error('Missing required --user-id argument.');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE url or service role key. Expected VITE_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const csvPath = path.resolve(repoRoot, options.file);
  const csvText = await fs.readFile(csvPath, 'utf8');
  const rows = parseCsv(csvText);
  if (!rows.length) {
    throw new Error(`No rows found in ${csvPath}.`);
  }

  if (options.replace) {
    await deleteExistingData(supabaseUrl, supabaseKey, options.userId);
  } else {
    await assertNoExistingData(supabaseUrl, supabaseKey, options.userId);
  }

  const payload = buildImportPayload(rows, options.userId);

  await insertRows(supabaseUrl, supabaseKey, 'projects', payload.projects);
  await insertRows(supabaseUrl, supabaseKey, 'tasks', payload.tasks);
  await insertRows(supabaseUrl, supabaseKey, 'time_logs', payload.timeLogs);

  console.log(`Imported ${payload.projects.length} projects, ${payload.tasks.length} tasks, and ${payload.timeLogs.length} time logs for user ${options.userId}.`);
}

function parseArgs(args) {
  const options = {
    file: 'boosted.csv',
    userId: '',
    replace: false,
    help: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--replace') {
      options.replace = true;
      continue;
    }
    if (arg === '--file') {
      options.file = args[++i] ?? '';
      continue;
    }
    if (arg === '--user-id') {
      options.userId = args[++i] ?? '';
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/import-boosted.mjs --user-id <supabase-user-uuid> [--file boosted.csv] [--replace]

Notes:
  --user-id   Required. The auth.users.id that should own imported rows.
  --replace   Deletes this user's existing projects, tasks, and time_logs before import.

Environment:
  VITE_SUPABASE_URL or SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
}

function loadDotEnv(filePath) {
  try {
    const envText = fsSync.readFileSync(filePath, 'utf8');
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex === -1) continue;

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional convenience only.
  }
}

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(field);
      field = '';
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...dataRows] = rows;
  return dataRows.map((values, index) => mapBoostedRow(header, values, index + 2));
}

function mapBoostedRow(header, values, lineNumber) {
  const record = Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']));

  const projectName = record['Project name']?.trim();
  if (!projectName) {
    throw new Error(`Line ${lineNumber}: missing project name.`);
  }

  const date = record.Date?.trim();
  const startTime = record['Start time']?.trim();
  const endTime = record['End time']?.trim();
  const timeZone = record['Time zone']?.trim();
  if (!date || !startTime || !endTime || !timeZone) {
    throw new Error(`Line ${lineNumber}: missing date/time/time zone fields.`);
  }

  return {
    projectName,
    taskName: record['Task name']?.trim() || null,
    date,
    startTime,
    endTime,
    timeZone,
    projectArchived: parseBoolean(record['Project archived']),
    taskCompleted: parseBoolean(record['Task completed']),
    startIso: `${date}T${startTime}${timeZone}`,
    endIso: `${date}T${endTime}${timeZone}`
  };
}

function parseBoolean(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true';
}

function buildImportPayload(rows, userId) {
  const projectMap = new Map();
  const taskMap = new Map();
  const timeLogs = [];

  for (const row of rows) {
    const projectKey = row.projectName;
    const project = projectMap.get(projectKey) ?? {
      id: crypto.randomUUID(),
      user_id: userId,
      name: row.projectName,
      color: projectColor(row.projectName),
      archived: row.projectArchived,
      created_at: row.startIso,
      updated_at: row.endIso
    };
    project.archived = project.archived || row.projectArchived;
    project.created_at = minIso(project.created_at, row.startIso);
    project.updated_at = maxIso(project.updated_at, row.endIso);
    projectMap.set(projectKey, project);

    let taskId = null;
    if (row.taskName) {
      const taskKey = `${row.projectName}::${row.taskName}`;
      const task = taskMap.get(taskKey) ?? {
        id: crypto.randomUUID(),
        user_id: userId,
        project_id: project.id,
        name: row.taskName,
        archived: false,
        completed: row.taskCompleted,
        created_at: row.startIso,
        updated_at: row.endIso
      };
      task.completed = task.completed || row.taskCompleted;
      task.created_at = minIso(task.created_at, row.startIso);
      task.updated_at = maxIso(task.updated_at, row.endIso);
      taskMap.set(taskKey, task);
      taskId = task.id;
    }

    timeLogs.push({
      id: crypto.randomUUID(),
      user_id: userId,
      project_id: project.id,
      task_id: taskId,
      start_time: row.startIso,
      end_time: row.endIso,
      deleted_at: null,
      created_at: row.startIso,
      updated_at: row.endIso
    });
  }

  return {
    projects: [...projectMap.values()],
    tasks: [...taskMap.values()],
    timeLogs
  };
}

function projectColor(name) {
  const palette = ['#2e7d5b', '#3d6fb4', '#b46b3d', '#7f5af0', '#d97706', '#0f766e', '#be185d', '#4f46e5'];
  const hash = [...name].reduce((value, char) => value + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function minIso(left, right) {
  return new Date(left).getTime() <= new Date(right).getTime() ? left : right;
}

function maxIso(left, right) {
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

async function assertNoExistingData(supabaseUrl, supabaseKey, userId) {
  const [projects, tasks, logs] = await Promise.all([
    countRows(supabaseUrl, supabaseKey, 'projects', userId),
    countRows(supabaseUrl, supabaseKey, 'tasks', userId),
    countRows(supabaseUrl, supabaseKey, 'time_logs', userId)
  ]);

  if (projects || tasks || logs) {
    throw new Error(`User ${userId} already has data (${projects} projects, ${tasks} tasks, ${logs} time_logs). Re-run with --replace if that is intentional.`);
  }
}

async function countRows(supabaseUrl, supabaseKey, table, userId) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'count=exact'
    }
  });

  if (!response.ok) {
    throw await toError(response, `Failed to count ${table}`);
  }

  const countHeader = response.headers.get('content-range');
  if (!countHeader) {
    const rows = await response.json();
    return Array.isArray(rows) ? rows.length : 0;
  }

  const total = countHeader.split('/')[1];
  return Number(total ?? 0);
}

async function deleteExistingData(supabaseUrl, supabaseKey, userId) {
  for (const table of ['time_logs', 'tasks', 'projects']) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      throw await toError(response, `Failed to delete existing ${table}`);
    }
  }
}

async function insertRows(supabaseUrl, supabaseKey, table, rows, chunkSize = 500) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(chunk)
    });

    if (!response.ok) {
      throw await toError(response, `Failed to insert into ${table}`);
    }
  }
}

async function toError(response, prefix) {
  let details = '';
  try {
    const payload = await response.json();
    details = payload.message || payload.error_description || payload.error || JSON.stringify(payload);
  } catch {
    details = await response.text();
  }
  return new Error(`${prefix}: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
