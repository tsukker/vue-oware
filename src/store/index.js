import Vue from 'vue'
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    moves: [],
    mySide: 0,
    turn: 0,
  },
  mutations: {
    clearMoves(state) {
      state.moves = [];
    },
    pushMove(state, move) {
      state.moves.push(move);
    },
    switchTurn(state) {
      state.turn = 1 - state.turn;
    }
  }
});
