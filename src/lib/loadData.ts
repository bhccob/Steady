export type Loaded<T> = { data: T } | { problem: string };

/**
 * Runs a screen's load so the screen never stays blank: an error, nothing found, or a load
 * slower than `ms` comes back as a problem the screen shows with a way to try again.
 */
export async function loadData<T>(load: () => Promise<T | null>, ms = 8000): Promise<Loaded<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<'late'>((resolve) => (timer = setTimeout(() => resolve('late'), ms)));
  try {
    const result = await Promise.race([load(), late]);
    if (result === 'late') return { problem: 'It took too long.' };
    return result === null ? { problem: 'Nothing was found.' } : { data: result };
  } catch (e) {
    return { problem: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}
