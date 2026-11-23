import test from 'node:test';
import assert from 'node:assert/strict';
import { indexNotice } from '../src/evidence.ts';
import { acceptImpact, createDemoWorkspace, factChanges, graphFromBrief, impacts, keepImpact, matchImpact, saveNode } from '../src/trailEngine.ts';

const brief = fields => ({title:'Notice', summary:'', actions:[], dates:[], questions:[], ...fields});

test('every garden fact and relationship quotes its own version', () => {
  const workspace = createDemoWorkspace();
  for (const version of workspace.versions) {
    const find = indexNotice(version.text);
    assert.equal(new Set(version.nodes.map(node => node.id)).size, version.nodes.length);
    for (const node of version.nodes) {
      assert.equal(node.status, 'verified');
      assert.ok(find(node.quote), node.title);
      if (node.rawDate) assert.ok(find(node.rawDate), node.rawDate);
    }
    for (const edge of version.edges) {
      assert.ok(version.nodes.some(node => node.id === edge.source));
      assert.ok(version.nodes.some(node => node.id === edge.target));
      assert.ok(find(edge.quote));
    }
  }
  assert.deepEqual(workspace.versions[0].nodes.map(node => node.id), workspace.versions[1].nodes.map(node => node.id));
});

test('saving the same logical fact in two versions creates one journey task', () => {
  const workspace = createDemoWorkspace();
  const once = saveNode(workspace,'garden-agreement','garden-original');
  const twice = saveNode(once,'garden-agreement','garden-updated');
  assert.equal(twice.tasks.length,1);
  assert.equal(twice.tasks[0].versionId,'garden-original');
  assert.equal(workspace.tasks.length,0);
});

test('accepting changed source retains task identity but reopens completion and clears the confirmed date', () => {
  let workspace = saveNode(createDemoWorkspace(),'garden-agreement','garden-original');
  workspace = {...workspace,tasks:workspace.tasks.map(task => ({...task,done:true,due:'2027-04-17'}))};
  const impact = impacts(workspace)[0];
  assert.equal(impact.kind,'changed');
  assert.match(impact.previous.quote,/April 17/);
  assert.match(impact.next.quote,/April 16/);
  const updated = acceptImpact(workspace,workspace.tasks[0].id);
  assert.equal(updated.tasks[0].id,workspace.tasks[0].id);
  assert.equal(updated.tasks[0].done,false);
  assert.equal(updated.tasks[0].due,'');
  assert.equal(updated.tasks[0].versionId,'garden-updated');
  assert.equal(updated.reviews[0].decision,'accepted');
  assert.deepEqual(impacts(updated),[]);
  assert.equal(workspace.tasks[0].due,'2027-04-17');
});

test('keeping a reviewed step preserves its provenance and settles only that revision', () => {
  let workspace = saveNode(createDemoWorkspace(),'garden-agreement','garden-original');
  workspace = {...workspace,tasks:workspace.tasks.map(task => ({...task,done:true,due:'2026-04-17'}))};
  const kept = keepImpact(workspace, workspace.tasks[0].id);
  assert.equal(kept.tasks[0].versionId, 'garden-original');
  assert.equal(kept.tasks[0].done, true);
  assert.equal(kept.tasks[0].due, '2026-04-17');
  assert.equal(kept.tasks[0].reviewVersionId, 'garden-updated');
  assert.deepEqual(impacts(kept), []);
  assert.equal(keepImpact(kept, kept.tasks[0].id), kept, 'a second click cannot duplicate the review');
  const newer = {...kept.versions.at(-1), id:'garden-third'};
  assert.equal(impacts({...kept, versions:[...kept.versions,newer]}).length, 1);
});

test('old keep-for-now log entries alone do not silently settle an unreviewed step', () => {
  const workspace = saveNode(createDemoWorkspace(),'garden-agreement','garden-original');
  const legacy = {...workspace, reviews:[{id:'legacy',taskId:workspace.tasks[0].id,versionId:'garden-updated',decision:'kept',created:0}]};
  assert.equal(impacts(legacy).length, 1);
});

test('explicit source matching validates target and prevents duplicate saved steps', () => {
  let workspace = saveNode(createDemoWorkspace(),'garden-agreement','garden-original');
  const id = workspace.tasks[0].id;
  assert.equal(matchImpact(workspace,id,'missing'),workspace);
  assert.equal(matchImpact(workspace,id,'garden-location'),workspace);
  workspace = saveNode(workspace,'garden-bring','garden-updated');
  assert.equal(matchImpact(workspace,id,'garden-bring'),workspace);
  workspace = {...workspace,tasks:workspace.tasks.map(task => task.id === id ? {...task,done:true,due:'2026-04-17'} : task)};
  const matched = matchImpact(workspace,id,'garden-alternative');
  assert.equal(matched.tasks[0].nodeId,'garden-alternative');
  assert.equal(matched.tasks[0].versionId,'garden-updated');
  assert.equal(matched.tasks[0].done,false);
  assert.equal(matched.tasks[0].due,'');
  assert.equal(matched.tasks[0].quote,workspace.versions.at(-1).nodes.find(node=>node.id==='garden-alternative').quote);
});

test('fact changes include conditions, dates, evidence status, and obligations but ignore typography', () => {
  const original = createDemoWorkspace().versions[0].nodes[0];
  assert.deepEqual(factChanges(original,{...original,title:'  '+original.title.toUpperCase()+'  '}),[]);
  assert.deepEqual(factChanges(original,{...original,condition:'If attending',rawDate:'April 18',status:'needs_review',obligation:'conditional'}),
    ['Date as written','Obligation','Condition','Evidence status']);
});

test('a changed obligation triggers review even when its source quotation is unchanged', () => {
  const initial = createDemoWorkspace().versions[0];
  const next = {...initial,id:'next',nodes:initial.nodes.map(node=>({...node,obligation:'suggested'}))};
  const workspace = saveNode({id:'changes',title:'Changes',versions:[initial,next],tasks:[],reviews:[]},initial.nodes[0].id,initial.id);
  assert.equal(impacts(workspace).length,1);
});

test('an unrelated version preserves the saved step and reports uncertainty', () => {
  const workspace = saveNode(createDemoWorkspace(),'garden-agreement','garden-original');
  const unrelated = graphFromBrief(brief({actions:[{task:'Return your books',evidence:'Return your books.'}]}),'Return your books.','ON_DEVICE');
  const updated = {...workspace,versions:[...workspace.versions,unrelated]};
  assert.equal(impacts(updated)[0].kind,'unmatched');
  assert.equal(impacts(updated)[0].next,undefined);
  assert.deepEqual(acceptImpact(updated,updated.tasks[0].id),updated);
  assert.equal(updated.tasks[0].versionId,'garden-original');
});

test('unchanged source facts retain IDs across versions and do not duplicate', () => {
  const input = brief({actions:[{task:'Return your books',evidence:'Return your books.'},{task:'Return your books',evidence:'Return your books.'}]});
  const original = graphFromBrief(input,'Return your books.','ON_DEVICE');
  const updated = graphFromBrief(input,'Return your books. More information follows.','IN_CLOUD',original);
  assert.equal(original.nodes.length,1);
  assert.equal(updated.nodes[0].id,original.nodes[0].id);
  const workspace = saveNode({id:'test',title:'Test',versions:[original,updated],tasks:[],reviews:[]},original.nodes[0].id,original.id);
  assert.deepEqual(impacts(workspace),[]);
});

test('unmatched text claims and invalid date excerpts cannot create supported objects', () => {
  const result = graphFromBrief(brief({
    actions:[{task:'Pay a fee',evidence:'A fee is required.'},{task:'Return books',evidence:'Return your books by June 17.'}],
    dates:[{date:'June 1',meaning:'Return deadline',evidence:'Return your books by June 17.'}],
  }),'Return your books by June 17.','ON_DEVICE');
  assert.equal(result.nodes.length,1);
  assert.equal(result.nodes[0].title,'Return books');
  assert.equal(result.nodes[0].status,'verified');
});

test('image transcriptions remain reviewable and cannot appear verified', () => {
  const result = graphFromBrief(brief({actions:[{task:'Pay the amount shown',evidence:'Pay 18 dollars.'}]}),'Pay 18 dollars.','IN_CLOUD',undefined,true);
  assert.equal(result.nodes.length,1);
  assert.equal(result.nodes[0].status,'needs_review');
  assert.equal(result.edges.length,0);
});

test('the sentence condition survives a shorter action excerpt', () => {
  const text = 'If you cannot attend, email garden@example.com by April 15 to request another session.';
  const result = graphFromBrief(brief({actions:[{task:'Email to request another session',evidence:'email garden@example.com by April 15'}]}),text,'ON_DEVICE');
  assert.equal(result.nodes[0].obligation,'conditional');
  assert.match(result.nodes[0].condition,/If you cannot attend/);
  assert.ok(indexNotice(text)(result.nodes[0].quote));
  assert.match(result.nodes[0].quote,/If you cannot attend/);
});

test('a notice with no actions or dates yields no fabricated graph', () => {
  const result = graphFromBrief(brief({}),'Thank you for being part of our community.','ON_DEVICE');
  assert.deepEqual(result.nodes,[]);
  assert.deepEqual(result.edges,[]);
});

test('explicit optional wording remains suggested when an action excerpt omits the qualifier', () => {
  const text = 'You may bring a water bottle. Bring a photo ID.';
  const result = graphFromBrief(brief({actions:[
    {task:'Bring water',evidence:'bring a water bottle'},
    {task:'Bring ID',evidence:'Bring a photo ID.'},
  ]}),text,'ON_DEVICE');
  assert.equal(result.nodes[0].obligation,'suggested');
  assert.match(result.nodes[0].quote,/You may/);
  assert.equal(result.nodes[1].obligation,'required');
});

test('questions stay suggestions and cannot be saved as required journey steps', () => {
  const version = graphFromBrief(brief({questions:['Where is the form?']}),'Complete the form.','ON_DEVICE');
  assert.equal(version.nodes[0].obligation,'suggested');
  assert.equal(version.nodes[0].status,'needs_review');
  const workspace = {id:'test',title:'Test',versions:[version],tasks:[],reviews:[]};
  assert.equal(saveNode(workspace,version.nodes[0].id,version.id).tasks.length,0);
});

test('May dates remain required while omitted negation stays visibly unverified', () => {
  const text = 'Submit the form by May 17. Do not pay a fee.';
  const result = graphFromBrief(brief({actions:[
    {task:'Submit the form',evidence:'Submit the form by May 17.'},
    {task:'Pay a fee',evidence:'pay a fee'},
  ]}),text,'ON_DEVICE');
  assert.equal(result.nodes[0].obligation,'required');
  assert.equal(result.nodes[1].status,'needs_review');
  assert.match(result.nodes[1].quote,/Do not/);
});

test('legacy graph rejects literal inventions and passages repeated under conflicting conditions', () => {
  const text = 'Pay 20 dollars. If attending, submit the form. Otherwise, do not submit the form.';
  const result = graphFromBrief(brief({actions:[
    {task:'Pay 200 dollars',evidence:'Pay 20 dollars.'},
    {task:'Submit the form',evidence:'submit the form'},
  ]}),text,'ON_DEVICE');
  assert.deepEqual(result.nodes,[]);
});
