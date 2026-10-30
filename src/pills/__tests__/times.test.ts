import { addOtherTime, otherTimes, TIME_TILES, toggleTile } from '../times';

describe('time tiles', () => {
  it('offers morning, midday and evening', () => {
    expect(TIME_TILES.map((t) => [t.label, t.minutes])).toEqual([
      ['Morning', 480],
      ['Midday', 780],
      ['Evening', 1140],
    ]);
  });

  it('adds a tile time in order of the day', () => {
    expect(toggleTile([1140], 480)).toEqual([480, 1140]);
  });

  it('takes a tile time away when it is tapped again', () => {
    expect(toggleTile([480, 1140], 480)).toEqual([1140]);
  });

  it('keeps the last time, so a pill always has one', () => {
    expect(toggleTile([480], 480)).toEqual([480]);
  });
});

describe('other times', () => {
  it('are the times that are not on a tile', () => {
    expect(otherTimes([480, 615, 1140])).toEqual([615]);
  });

  it('start at 21:00', () => {
    expect(addOtherTime([480])).toEqual([480, 1260]);
  });

  it('move on a quarter hour when 21:00 is taken', () => {
    expect(addOtherTime([480, 1260])).toEqual([480, 1260, 1275]);
  });
});
