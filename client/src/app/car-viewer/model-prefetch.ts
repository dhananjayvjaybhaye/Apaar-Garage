type ModelData = { buffer: ArrayBuffer; basePath: string };

const cache = new Map<string, { expires: number; data: Promise<ModelData> }>();
const lifetime = 60_000;

export function prefetchModel(url: string) {
  if (prefetchedModel(url)) return;
  // Keep only a few recently hovered models and abort stalled downloads.
  if (cache.size >= 3) cache.delete(cache.keys().next().value!);
  const data = fetch(url, { cache: 'force-cache', signal: AbortSignal.timeout(20_000) }).then(async (response) => {
    if (!response.ok) throw new Error('3D model request failed.');
    return { buffer: await response.arrayBuffer(), basePath: new URL('.', response.url).href };
  });
  cache.set(url, { data, expires: Date.now() + lifetime });
  const clear = () => { if (cache.get(url)?.data === data) cache.delete(url); };
  void data.catch(clear);
  setTimeout(clear, lifetime);
}

export function prefetchedModel(url: string) {
  const entry = cache.get(url);
  return entry && entry.expires > Date.now() ? entry.data : undefined;
}
