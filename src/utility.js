"use strict";

export function generateRandomRoomId(charSet = "0123456789", len = 5) {
  let cl = charSet.length;
  let r = "";
  for (let i = 0; i < len; ++i) {
    r += charSet[Math.floor(Math.random() * cl)];
  }
  return r;
}

export function isValidRoomId(roomId) {
  const cl = roomId.length;
  if (cl !== 5) {
    return false;
  }
  for (let i = 0; i < cl; ++i) {
    if (roomId[i] < '0' || '9' < roomId[i]) {
      return false;
    }
  }
  return true;
}

export function getNextHouses(previousHouses, move) {
  let houses = previousHouses.slice();
  const skip = [6, 13, move.selected];
  const captured = [2, 3];
  let houseIndex = move.selected;
  for (let count = 0; count < houses[move.selected]; ++count) {
    houseIndex = (houseIndex + 1) % 14;
    while (skip.includes(houseIndex)) {
      houseIndex = (houseIndex + 1) % 14;
    }
    houses[houseIndex] += 1;
  }
  houses[move.selected] = 0;
  const oppositeSide = 1 - move.playerSide;
  if (oppositeSide * 7 <= houseIndex && houseIndex < oppositeSide * 7 + 6) {
    for (let index = houseIndex; oppositeSide * 7 <= index; --index) {
      if (captured.includes(houses[index])) {
        houses[move.playerSide * 7 + 6] += houses[index];
        houses[index] = 0;
      } else {
        break;
      }
    }
  }
  return houses;
}

export function isValidMove(houses, move) {
  const skip = [6, 13];
  if (move.selected < move.playerSide * 7 || move.playerSide * 7 + 6 <= move.selected) {
    return false;
  }
  if (houses[move.selected] == 0) {
    return false;
  }
  skip.push(move.selected);
  let nextHouse = getNextHouses(houses, move);
  let oppositeSeeds = 0;
  const oppositeSide = 1 - move.playerSide;
  for (let index = oppositeSide * 7; index < oppositeSide * 7 + 6; ++index) {
    oppositeSeeds += nextHouse[index];
  }
  if (oppositeSeeds == 0) {
    return false;
  }
  return true;
}

export function owareBoard(moves) {
  let houses = Array(14).fill(4);
  houses[6] = 0;
  houses[13] = 0;
  moves.forEach((move) => {
    if (!isValidMove(houses, move)) {
      throw new Error("Invalid move.");
    }
    houses = getNextHouses(houses, move);
  });
  return houses;
}
