import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { stringify as yamlStringify } from 'yaml';
import type { Page } from 'playwright';
import type { RouteSummary } from '../core/types.js';

interface AXNode {
  role: string;
  name: string;
  children?: AXNode[];
  level?: number;
  [key: string]: unknown;
}

export async function extractA11yTree(page: Page): Promise<AXNode | null> {
  // Use CDP for forward compatibility (page.accessibility.snapshot() deprecated in 1.41+)
  const client = await page.context().newCDPSession(page);
  const { nodes } = await client.send('Accessibility.getFullAXTree');
  await client.detach();

  if (!nodes || nodes.length === 0) return null;

  // Build tree from flat node list
  const nodeMap = new Map<string, AXNode>();
  const rootId = nodes[0]?.nodeId;

  for (const node of nodes) {
    const axNode: AXNode = {
      role: node.role?.value ?? 'unknown',
      name: node.name?.value ?? '',
    };
    if (node.properties) {
      for (const prop of node.properties) {
        axNode[prop.name] = prop.value?.value;
      }
    }
    nodeMap.set(node.nodeId, axNode);
  }

  for (const node of nodes) {
    if (node.childIds && node.childIds.length > 0) {
      const parent = nodeMap.get(node.nodeId);
      if (parent) {
        parent.children = node.childIds
          .map((id: string) => nodeMap.get(id))
          .filter(Boolean) as AXNode[];
      }
    }
  }

  return nodeMap.get(rootId) ?? null;
}

export function saveA11yTree(tree: AXNode | null, savePath: string) {
  mkdirSync(dirname(savePath), { recursive: true });
  writeFileSync(savePath, yamlStringify(tree ?? {}), 'utf-8');
}

export function extractSummary(tree: AXNode | null): RouteSummary {
  const summary: RouteSummary = {
    headings: [],
    landmarks: [],
    interactiveElements: { links: 0, buttons: 0, inputs: 0 },
    tabOrder: [],
  };

  if (!tree) return summary;

  const landmarkRoles = new Set([
    'banner', 'navigation', 'main', 'contentinfo',
    'complementary', 'region', 'search', 'form',
  ]);
  const interactiveRoles: Record<string, string> = {
    link: 'links',
    button: 'buttons',
    textbox: 'inputs',
    combobox: 'inputs',
    checkbox: 'inputs',
    radio: 'inputs',
    slider: 'inputs',
    spinbutton: 'inputs',
    searchbox: 'inputs',
  };

  function walk(node: AXNode) {
    if (node.role === 'heading' && node.name) {
      summary.headings.push({
        level: typeof node.level === 'number' ? node.level : 0,
        text: node.name,
      });
    }
    if (landmarkRoles.has(node.role)) {
      summary.landmarks.push({ role: node.role });
    }
    const countKey = interactiveRoles[node.role];
    if (countKey) {
      summary.interactiveElements[countKey] =
        (summary.interactiveElements[countKey] ?? 0) + 1;
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  walk(tree);
  return summary;
}
