import { loadData } from '../loadData';

describe('loadData', () => {
  it('gives the data a screen loaded', async () => {
    expect(await loadData(async () => ({ name: 'sam' }))).toEqual({ data: { name: 'sam' } });
  });

  it('turns a failed load into a problem the screen can show, instead of staying blank', async () => {
    const result = await loadData(async () => {
      throw new Error('database is locked');
    });
    expect(result).toEqual({ problem: 'database is locked' });
  });

  it('turns "nothing found" into a problem too', async () => {
    expect(await loadData(async () => null)).toEqual({ problem: 'Nothing was found.' });
  });

  it('gives up on a load that never finishes', async () => {
    jest.useFakeTimers();
    try {
      const result = loadData(() => new Promise<never>(() => {}), 8000);
      jest.advanceTimersByTime(8000);
      expect(await result).toEqual({ problem: 'It took too long.' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a slow load that finishes in time', async () => {
    jest.useFakeTimers();
    try {
      const result = loadData(() => new Promise<number>((resolve) => setTimeout(() => resolve(42), 7000)), 8000);
      jest.advanceTimersByTime(7000);
      expect(await result).toEqual({ data: 42 });
    } finally {
      jest.useRealTimers();
    }
  });
});
