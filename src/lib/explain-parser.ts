export interface ExplainNode {
  "Node Type": string;
  "Plans"?: ExplainNode[];
  "Actual Loops"?: number;
  "Actual Total Time"?: number;
  "Startup Cost"?: number;
  "Total Cost"?: number;
  "Relation Name"?: string;
  [key: string]: unknown;
}

export interface ExecutionTimeline {
  nodeType: string;
  relationName?: string;
  duration: number;
  loops: number;
  percentage: number;
  children?: ExecutionTimeline[];
}

export function parseExplain(explainJson: Record<string, unknown>): ExecutionTimeline | null {
  const plan = (explainJson.Plan as ExplainNode) || null;
  if (!plan) return null;

  const totalTime = (explainJson["Planning Time"] as number || 0) +
                    (explainJson["Execution Time"] as number || 0);

  function buildTimeline(node: ExplainNode, parentTime: number): ExecutionTimeline {
    const duration = node["Actual Total Time"] || node["Total Cost"] || 0;
    return {
      nodeType: node["Node Type"],
      relationName: node["Relation Name"],
      duration: Math.round((duration as number) * 100) / 100,
      loops: node["Actual Loops"] || 1,
      percentage: Math.round(((duration as number) / parentTime) * 100),
      children: node.Plans?.map((child) => buildTimeline(child, duration as number)),
    };
  }

  return buildTimeline(plan, totalTime || 1);
}

export function findBottleneck(timeline: ExecutionTimeline): ExecutionTimeline | null {
  if (!timeline.children || timeline.children.length === 0) {
    return timeline;
  }
  const slowestChild = timeline.children.reduce((max, child) =>
    child.duration > max.duration ? child : max
  );
  return findBottleneck(slowestChild);
}
