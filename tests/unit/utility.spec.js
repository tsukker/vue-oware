import { getNextHouses } from '@/utility.js';

describe("utility.js getNextHouse", () => {
  it("should return correct array of houses", () => {
    let houses = [];
    let move = { playerSide: 0, selected: 5 };
    houses = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
    let result = getNextHouses(houses, move);
    expect(result).toBeInstanceOf(Array);
    expect(result).toStrictEqual([4, 4, 4, 4, 4, 0, 0, 5, 5, 5, 5, 4, 4, 0]);
    expect(houses).toStrictEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);

    houses = [20, 0, 1, 2, 3, 4, 0, 2, 0, 1, 0, 16, 4, 99];
    move.selected = 0;
    result = getNextHouses(houses, move);
    expect(result).toStrictEqual([0, 2, 3, 4, 5, 6, 7, 4, 0, 0, 0, 17, 5, 99]);
    move = { playerSide: 1, selected: 11 };
    result = getNextHouses(houses, move);
    expect(result).toStrictEqual([22, 2, 3, 4, 4, 5, 0, 3, 1, 2, 1, 0, 6, 99]);
  });
});
