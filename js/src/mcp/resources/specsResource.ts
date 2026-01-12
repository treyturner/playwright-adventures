import fs from 'fs';
import path from 'path';
import { McpResource } from '../types';

const SPEC_FILES = [
  { id: 'journeys', filename: 'journeys.yaml', mimeType: 'application/yaml' },
  { id: 'selectors', filename: 'selectors.md', mimeType: 'text/markdown' },
  { id: 'testing-philosophy', filename: 'testing-philosophy.md', mimeType: 'text/markdown' }
];

export const loadSpecResources = (): McpResource[] => {
  const repoRoot = path.resolve(__dirname, '../../../..');
  const specDir = path.join(repoRoot, 'common', 'specs');

  return SPEC_FILES.map(({ id, filename, mimeType }) => {
    const filePath = path.join(specDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      id,
      name: filename,
      path: filePath,
      mimeType,
      content
    } satisfies McpResource;
  });
};
