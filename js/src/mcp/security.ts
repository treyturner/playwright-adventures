import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const SUPPORTED_SCREENSHOT_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png']);

export interface BrowserSecurityPolicy {
  baseURL: string;
  allowedOrigins: ReadonlySet<string>;
  screenshotDir: string;
}

const parseHttpUrl = (value: string, label: string): URL => {
  if (value !== value.trim() || value.includes('\\') || /\s/.test(value)) {
    throw new Error(`${label} must be an absolute HTTP(S) URL`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP(S) URL`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain credentials`);
  }
  return parsed;
};

const parseAllowedOrigin = (value: string): string => {
  const parsed = parseHttpUrl(value, 'Allowed origin');
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Allowed origin must contain only a scheme, host, and optional port');
  }
  return parsed.origin;
};

export const createBrowserSecurityPolicy = (
  environment: NodeJS.ProcessEnv = process.env,
  workingDirectory: string = process.cwd()
): BrowserSecurityPolicy => {
  const parsedBaseURL = parseHttpUrl(environment.BASE_URL || DEFAULT_BASE_URL, 'BASE_URL');
  const configuredOrigins = environment.MCP_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(
    configuredOrigins?.length ? configuredOrigins.map(parseAllowedOrigin) : [parsedBaseURL.origin]
  );
  const screenshotDir = path.resolve(workingDirectory, environment.MCP_SCREENSHOT_DIR || 'screenshots');

  return { baseURL: parsedBaseURL.href, allowedOrigins, screenshotDir };
};

export const validateNavigationUrl = (value: string, allowedOrigins: ReadonlySet<string>): string => {
  const parsed = parseHttpUrl(value, 'Navigation URL');
  if (!allowedOrigins.has(parsed.origin)) {
    throw new Error(`Navigation blocked: origin ${parsed.origin} is not allowed`);
  }
  return parsed.href;
};

const validateScreenshotFilename = (filename: string): void => {
  if (
    !filename ||
    filename === '.' ||
    filename === '..' ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0') ||
    path.isAbsolute(filename) ||
    path.win32.isAbsolute(filename)
  ) {
    throw new Error('Screenshot path must be a filename inside MCP_SCREENSHOT_DIR');
  }

  if (!SUPPORTED_SCREENSHOT_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
    throw new Error('Screenshot filename must end in .png, .jpg, or .jpeg');
  }
};

export const resolveScreenshotPath = (
  policy: BrowserSecurityPolicy,
  requestedFilename?: string,
  timestamp: number = Date.now()
): string => {
  const filename = requestedFilename ?? `shot-${timestamp}.png`;
  validateScreenshotFilename(filename);
  fs.mkdirSync(policy.screenshotDir, { recursive: true });

  const resolvedPath = path.join(policy.screenshotDir, filename);
  try {
    if (fs.lstatSync(resolvedPath).isSymbolicLink()) {
      throw new Error('Screenshot target must not be a symbolic link');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return resolvedPath;
};
