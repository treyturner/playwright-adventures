import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpResource } from '../types.js';

const SPEC_FILES = [
  { id: 'journeys', filename: 'journeys.yaml', mimeType: 'application/yaml' },
  { id: 'selectors', filename: 'selectors.md', mimeType: 'text/markdown' },
  { id: 'testing-philosophy', filename: 'testing-philosophy.md', mimeType: 'text/markdown' }
];

export const loadSpecResources = (): McpResource[] => {
  const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
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

const findRepoRoot = (startDir: string): string => {
  let currentDir = startDir;

  while (true) {
    if (fs.existsSync(path.join(currentDir, 'common', 'specs'))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Unable to locate common/specs from ${startDir}`);
    }
    currentDir = parentDir;
  }
};
