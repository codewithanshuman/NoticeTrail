export type PlanInput = { task: string; notice: string; evidence: string; origin: string };
export type PlanItem = PlanInput & { id: string; created: number; done: boolean; due: string };
let connection: Promise<IDBDatabase> | undefined;

function database() {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('noticetrail-planner', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('tasks', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { connection = undefined; throw error; });
  }
  return connection;
}

export async function listTasks(): Promise<PlanItem[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('tasks').objectStore('tasks').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function modify(id: string, change: (current?: PlanItem) => PlanItem | undefined) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const request = store.get(id);
    request.onsuccess = () => {
      const next = change(request.result);
      if (next) store.put(next);
      else store.delete(id);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

export function taskId(input: PlanInput) {
  return JSON.stringify([input.notice, input.task, input.evidence, input.origin]);
}

export function saveTask(input: PlanInput, done = false) {
  const id = taskId(input);
  return modify(id, current => current ?? { ...input, id, created: Date.now(), due: '', done });
}

export function updateTask(id: string, fields: Partial<Pick<PlanItem, 'due' | 'done'>>) {
  return modify(id, current => current && { ...current, ...fields });
}

export function deleteTask(id: string) {
  return modify(id, () => undefined);
}
