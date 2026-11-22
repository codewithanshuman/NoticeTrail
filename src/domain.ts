import type { Source } from './types';

export type Fact = {
  id: string;
  kind: 'event' | 'action' | 'deadline' | 'requirement' | 'location' | 'question';
  title: string;
  description: string;
  quote: string;
  status: 'verified' | 'needs_review';
  obligation: 'required' | 'conditional' | 'suggested';
  rawDate?: string;
  condition?: string;
};

export type Relation = { id: string; source: string; target: string; label: string; quote: string };
export type Version = {
  id: string;
  label: string;
  created: number;
  source: Source;
  text: string;
  image?: string;
  method?: 'manual';
  nodes: Fact[];
  edges: Relation[];
};

export type JourneyTask = {
  id: string;
  nodeId: string;
  versionId: string;
  title: string;
  quote: string;
  done: boolean;
  due: string;
  reviewVersionId?: string;
};

export type Review = {
  id: string;
  taskId: string;
  versionId: string;
  decision: 'accepted' | 'kept';
  created: number;
};

export type Workspace = { id: string; title: string; versions: Version[]; tasks: JourneyTask[]; reviews: Review[] };
export type Impact = {
  task: JourneyTask;
  next?: Fact;
  previous?: Fact;
  kind: 'changed' | 'removed' | 'unmatched';
  versionId: string;
};
