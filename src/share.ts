import type { Project } from './types';

/**
 * Share a whole project in a link: the project is compressed and put after
 * the # of the URL, so it never touches a server and needs no account.
 */

const toB64Url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
};

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeProject(p: Project): Promise<string> {
  const { name, parts, wires, code, probes } = p;
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, name, parts, wires, code, probes }));
  if (typeof CompressionStream === 'undefined') return `j${toB64Url(json)}`;
  return `z${toB64Url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}

export async function decodeProject(token: string): Promise<unknown> {
  const kind = token[0], body = fromB64Url(token.slice(1));
  const bytes = kind === 'z' ? await pipe(body, new DecompressionStream('deflate-raw')) : body;
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const SHARE_PREFIX = '#p=';
