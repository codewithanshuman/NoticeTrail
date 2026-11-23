import type { Workspace } from './domain';

const revisions = new Map<string, number>();
let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve,reject) => {
    const request = indexedDB.open('noticetrail-workspaces',1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspaces',{keyPath:'id'});
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {db.close();connection=undefined;};
      resolve(db);
    };
  }).catch(error=>{connection=undefined;throw error;});
  return connection;
}
export async function listWorkspaces(): Promise<Workspace[]> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('workspaces').objectStore('workspaces').getAll();
    request.onsuccess=()=>resolve(request.result.map((record: Workspace & {storageRevision?:number})=>{
      const {storageRevision: _revision,...workspace}=record;
      return workspace;
    }));
    request.onerror=()=>reject(request.error);
  });
}
export async function loadWorkspace(id:string):Promise<Workspace|null> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('workspaces').objectStore('workspaces').get(id);
    request.onsuccess=()=>{
      const record=request.result as (Workspace & {storageRevision?:number}) | undefined;
      if(!record){revisions.delete(id);resolve(null);return;}
      const {storageRevision=0,...workspace}=record;
      // Explicitly reopening adopts the version just read. Background list refreshes
      // must never move this baseline: doing so could authorize a stale overwrite.
      revisions.set(id,storageRevision);
      resolve(workspace);
    };
    request.onerror=()=>reject(request.error);
  });
}
async function write(id:string, workspace?:Workspace) {
  const db=await database();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('workspaces','readwrite');
    const store=tx.objectStore('workspaces');
    const request=store.get(id);
    let nextRevision=0;
    let conflict=false;
    request.onsuccess=()=>{
      const current=request.result as (Workspace & {storageRevision?:number}) | undefined;
      const actual=current?.storageRevision??0;
      if((current || revisions.has(id)) && actual !== (revisions.get(id)??0)){
        conflict=true;
        tx.abort();
        return;
      }
      nextRevision=actual+1;
      if(workspace)store.put({...workspace,storageRevision:nextRevision});else store.delete(id);
    };
    tx.oncomplete=()=>{if(workspace)revisions.set(id,nextRevision);else revisions.delete(id);resolve();};
    tx.onabort=()=>reject(conflict?new Error('This workspace changed in another tab. Export your current edits, then reload before saving.'):tx.error??new Error('Workspace could not be saved.'));
    tx.onerror=()=>reject(tx.error);
  });
}
export function saveWorkspace(workspace:Workspace){return write(workspace.id,workspace);}
export function deleteWorkspace(id:string){return write(id);}
