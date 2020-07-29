<template>
  <div id="app">
    <header class="header">
      <h1>Oware</h1>
      <section class="auth">
        <!-- ログイン時にはフォームとログアウトボタンを表示 -->
        <div v-if="userLoggedin" key="login">
          [
          <a href="javascript:void(0)" @click.prevent="onClickUserName">{{ this.user.nickname }}</a>
          ({{this.user.email.match(/^[^@]*/)[0]}}) ]
          <button
            type="button"
            @click="doLogout"
          >Log out</button>
        </div>
        <!-- 未ログイン時にはログインボタンを表示 -->
        <div v-else key="logout">
          <button type="button" @click="doLogin">Log in</button>
        </div>
      </section>
      <section class="room">
        <!-- Already entered -->
        <div v-if="roomId">
          [{{ roomId }}]
          <button type="button" @click="onClickLeaveRoom">Leave room</button>
        </div>
        <!-- Not entered -->
        <div v-else>
          <button type="button" @click="onClickCreateRoom">Create room</button>
          <button type="button" @click="onClickEnterRoom">Enter room</button>
        </div>
      </section>
    </header>

    <section v-if="!isInValidRoom">Please login with Google account and create/enter a room.</section>
    <section v-else-if="getRoomInfo.status === 'initialized' && !gameStarted" class="select-side">
      <div>Start game!</div>
      <button
        v-for="(side, index) in [0, 1]"
        :key="index"
        @click="onClickSelectSide(side)"
        :disabled="selectSideDisabled(side)"
      >{{["First", "Second"][side]}}</button>
    </section>
    <section v-else-if="gameStarted && getRoomInfo.status === 'gameStarted'" class="game">
      <div class="game-opposite-nickname">[ {{opposite.nickname}} ]</div>
      <section class="game-board">
        <div class="game-board-opposite-scoring-house-wrapper">
          <div class="game-board-opposite-scoring-house">{{gameBoard.oppositeScoringHouse}}</div>
        </div>
        <section class="game-board-middle">
          <div class="game-board-opposite-houses">
            <div
              class="house-wrapper"
              v-for="(house, index) in gameBoard.oppositeHouses"
              :key="index"
            >
              <div class="house" :class="true ? 'selectable' : 'not-selectable'">{{house}}</div>
            </div>
          </div>
          <div v-if="!gameFinished" class="game-info">{{gameInfoDisplay}}</div>
          <section v-else class="game-result">
            <div>{{gameResult}}</div>
            <button type="button" @click="onClickRematch">Rematch</button>
          </section>
          <div class="game-board-my-houses">
            <div
              class="house-wrapper"
              v-for="(house, index) in gameBoard.myHouses"
              :key="index"
              @click="onClickHouse(index)"
            >
              <div class="house" :class="true ? 'selectable' : 'not-selectable'">{{house}}</div>
            </div>
          </div>
        </section>
        <div class="game-board-my-scoring-house-wrapper">
          <div class="game-board-my-scoring-house">{{gameBoard.myScoringHouse}}</div>
        </div>
      </section>
    </section>

    <!-- コンポーネント MyModal -->
    <MyModal @close="closeModal" v-if="modal.visible">
      <!-- default スロットコンテンツ -->
      <p>{{ modal.message }}</p>
      <div v-if="modal.inputVisible">
        <input
          v-model="modal.input"
          :pattern="modal.inputPattern"
          id="modal-input"
          @keydown.enter="modal.enterCallback"
          :placeholder="modal.inputPlaceholder"
        />
      </div>
      <!-- /default -->
      <!-- footer スロットコンテンツ -->
      <template slot="footer">
        <button type="button" @click="closeModal" style="color:#cc0000">Cancel</button>
        <button type="button" :disabled="modalEnterDisabled" @click="modal.enterCallback">Enter</button>
      </template>
      <!-- /footer -->
    </MyModal>
  </div>
</template>

<script>
"use strict";
import firebase from "firebase";
import MyModal from "./components/MyModal.vue";
import {
  generateRandomRoomId,
  isValidRoomId,
  owareBoard,
  isValidMove
} from "./utility.js";

export default {
  name: "App",
  components: {
    MyModal
  },
  data() {
    return {
      databaseRefs: [],
      modal: {
        visible: false,
        message: "",
        inputVisible: false,
        input: "",
        inputPlaceholder: "",
        inputPattern: "",
        enterCallback: null,
        isValidInput: null
      },
      room: {},
      roomId: "",
      user: {}
    };
  },
  computed: {
    gameBoard() {
      let board = owareBoard(this.$store.state.moves);
      let oppositeSide = 1 - this.$store.state.mySide;
      return {
        entireHouses: board,
        myHouses: board.slice(
          this.$store.state.mySide * 7,
          this.$store.state.mySide * 7 + 6
        ),
        myScoringHouse: board[this.$store.state.mySide * 7 + 6],
        oppositeHouses: board
          .slice(oppositeSide * 7, oppositeSide * 7 + 6)
          .reverse(),
        oppositeScoringHouse: board[oppositeSide * 7 + 6]
      };
    },
    myHouses() {
      return this.computed
        .entireBoard()
        .slice(this.$store.turn * 7, this.$store.turn * 7 + 6);
    },
    gameStatus() {
      return { initialized: 0, registration: 1, playing: 2, finished: 3 };
    },
    opposite() {
      return {
        nickname: this.room[`player${1 - this.$store.state.mySide}`].nickname
      };
    },
    modalEnterDisabled() {
      return !this.modal.isValidInput();
    },
    userLoggedin: function() {
      return this.user && this.user.uid;
    },
    isInValidRoom: function() {
      return isValidRoomId(this.roomId);
    },
    getRoomInfo: function() {
      return this.room;
    },
    selectSideDisabled() {
      return function(side) {
        if (this.$store.state.mySide != -1) {
          return true;
        }
        return this.room[`player${side}`].assigned;
      };
    },
    gameStarted() {
      if (!this.room.roomId) {
        return false;
      }
      if (this.room.status === "gameStarted") {
        return true;
      }
      if (this.room.status === "gameReady") {
        this.$store.commit("clearMoves");
        if (this.room.ownerId === firebase.auth().currentUser.uid) {
          const refRoom = firebase.database().ref(`data/${this.roomId}`);
          refRoom.update({ status: "gameStarted" });
          return true;
        }
      }
      console.log("this.room: ", this.room);
      console.log(
        "firebase.auth().currentUser.uid: ",
        firebase.auth().currentUser.uid
      );
      if (this.room.ownerId !== firebase.auth().currentUser.uid) {
        return false;
      }
      let gameReady = true;
      for (let i = 0; i < 2; ++i) {
        if (!this.room[`player${i}`].assigned) {
          gameReady = false;
          break;
        }
      }
      if (gameReady) {
        const refRoom = firebase.database().ref(`data/${this.roomId}`);
        refRoom.update({ status: "gameReady" });
      }
      return false;
    },
    lastSide() {
      let side = 0;
      const movesLength = this.$store.state.moves.length;
      if (
        movesLength === 0 ||
        this.$store.state.moves[movesLength - 1].playerSide === 1
      ) {
        side = 1;
      }
      return side;
    },
    isMyTurn() {
      let nextSide = 1 - this.lastSide;
      let mySide = this.$store.state.mySide;
      return (
        nextSide === mySide &&
        this.room[`player${mySide}`].id === firebase.auth().currentUser.uid
      );
    },
    gameInfoDisplay() {
      let message = "Opposite Turn";
      if (this.isMyTurn) {
        message = "Your Turn";
      }
      return message;
    },
    gameFinished() {
      if (
        this.gameBoard.myScoringHouse > 24 ||
        this.gameBoard.oppositeScoringHouse > 24
      ) {
        return true;
      }
      let nextSide = 1 - this.lastSide;
      let validMoveExists = false;
      let move = { selected: -1, playerSide: nextSide };
      for (let index = nextSide * 7; index < nextSide * 7 + 6; ++index) {
        move.selected = index;
        if (isValidMove(this.gameBoard.entireHouses, move)) {
          validMoveExists = true;
          break;
        }
      }
      if (!validMoveExists) {
        return true;
      }
      return false;
    },
    gameResult() {
      if (!this.gameFinished) {
        return;
      }
      let myAllHouses = this.gameBoard.myHouses.concat(
        this.gameBoard.myScoringHouse
      );
      let myTotal = myAllHouses.reduce(function(accumulator, currentValue) {
        return accumulator + currentValue;
      }, 0);
      console.log(
        "this.gameBoard.myHouses, myTotal: ",
        this.gameBoard.myHouses,
        myTotal
      );
      let result = "";
      if (myTotal == 24) {
        result = "Draw";
      } else if (myTotal > 24) {
        result = "Win";
      } else {
        result = "Lose";
      }
      return result;
    }
  },
  created() {
    firebase.auth().onAuthStateChanged(user => {
      this.user = user ? user : {};
      if (this.userLoggedin) {
        console.log("user: ", user);
        this.user.nickname = "Nickname";
        this.changeNickname();
      } else {
        if (this.roomId !== "") {
          this.leaveRoom(this.roomId);
        }
      }
    });
  },
  methods: {
    // ログイン処理
    doLogin() {
      if (this.userLoggedin) {
        alert("You are already logged in.");
        return;
      }
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider);
    },
    // ログアウト処理
    doLogout() {
      firebase.auth().signOut();
    },
    createRoom(roomId) {
      console.log(`createRoom, roomId: ${roomId}`);
      let path = `data/${roomId}`;
      const ref = firebase.database().ref(path);
      ref.update({
        createdAt: Date.now(),
        ownerId: firebase.auth().currentUser.uid,
        roomId: roomId,
        status: "initialized",
        player0: {
          assigned: false,
          id: "",
          nickname: ""
        },
        player1: {
          assigned: false,
          id: "",
          nickname: ""
        },
        moves: []
      });
      return roomId;
    },
    onClickCreateRoom() {
      // https://qiita.com/masato/items/f5c3be5da1040332c88c
      function loop(promise, fn) {
        return promise.then(fn).then(function(wrapper) {
          console.log("wrapper: ", wrapper);
          return !wrapper.done
            ? loop(Promise.resolve(wrapper.value), fn)
            : wrapper.value;
        });
      }
      function check(roomId) {
        let path = `data/${roomId}`;
        console.log("path: " + path);
        const ref = firebase.database().ref(path);
        return ref.once("value").then(snapshot => {
          const val = snapshot.val();
          console.log("val: ", val);
          return new Promise(resolve => {
            setTimeout(() => {
              if (
                snapshot.exists() &&
                (!val.ownerId ||
                  val.ownerId !== firebase.auth().currentUser.uid)
              ) {
                resolve({ done: false, value: generateRandomRoomId() });
              } else {
                resolve({ done: true, value: roomId });
              }
            }, 100);
          });
        });
      }
      loop(Promise.resolve(generateRandomRoomId()), check).then(roomId => {
        console.log("roomId: ", roomId);
        this.createRoom(roomId);
        this.enterRoom(roomId);
        return roomId;
      });
    },
    enterRoom(roomId) {
      console.log("enterRoom");
      if (!isValidRoomId(roomId)) {
        alert(`Room ID ${roomId} is not valid.`);
        return;
      }
      if (this.roomId !== "") {
        alert(`You already entered room #${this.roomId}`);
        return;
      }
      this.roomId = roomId;
      this.chat = [];
      const refRoom = firebase.database().ref(`data/${roomId}`);
      refRoom.on("value", this.fetchRoomInfo);
      this.databaseRefs.push(refRoom);
      console.log("ref registered: " + `data/${roomId}`);
      const refMoves = firebase.database().ref(`data/${roomId}/moves`);
      refMoves.on("child_added", this.moveAdded);
      this.databaseRefs.push(refMoves);
      console.log("ref registered: " + `data/${roomId}/moves`);
    },
    fetchRoomInfo(snapshot) {
      this.room = snapshot.val();
      console.log(this.room);
      if (this.room.ownerId !== firebase.auth().currentUser.uid) {
        return;
      }
    },
    openModal(modalProps) {
      let props = modalProps;
      Object.assign(props, {
        visible: true
      });
      Object.assign(this.modal, props);
      this.$nextTick().then(() =>
        document.getElementById("modal-input").focus()
      );
    },
    onClickEnterRoom() {
      console.log("onClickEnterRoom");
      const modalProps = {
        message: "Room ID",
        inputVisible: true,
        input: "",
        inputPlaceholder: "01234",
        inputPattern: "[0-9]*",
        enterCallback: this.onClickModalEnterRoomId,
        isValidInput: this.isValidRoomId
      };
      this.openModal(modalProps);
    },
    leaveRoom(roomId) {
      console.log("leaveRoom");
      if (roomId !== this.roomId) {
        console.log("roomId and this.roomId differ.");
        return;
      }
      const refRoom = firebase.database().ref(`data/${roomId}`);
      refRoom.on("value", this.fetchRoomInfo);
      const refMoves = firebase.database().ref(`data/${roomId}/moves`);
      refMoves.off("child_added", this.moveAdded);
      this.roomId = "";
    },
    onClickLeaveRoom() {
      this.leaveRoom(this.roomId);
    },
    closeModal() {
      this.modal.visible = false;
    },
    onClickModalEnterRoomId() {
      this.enterRoom(this.modal.input);
      this.closeModal();
    },
    changeNickname() {
      if (!this.userLoggedin) {
        alert("You seem to have not logged in.");
        return;
      }
      const modalProps = {
        message: "Your nickname",
        inputVisible: true,
        input: "",
        inputPlaceholder: "Your nickname",
        inputPattern: ".{1,}",
        enterCallback: this.onClickModalEnterNickname,
        isValidInput: this.isValidNickname
      };
      this.openModal(modalProps);
    },
    onClickModalEnterNickname() {
      this.user.nickname = this.modal.input;
      this.closeModal();
    },
    onClickUserName() {
      this.changeNickname();
    },
    moveAdded(snapshot) {
      const val = snapshot.val();
      console.log("moveAdded: ", val);
      this.$store.commit("pushMove", val);
    },
    isValidRoomId() {
      const s = this.modal.input;
      if (s.length !== 5) {
        return false;
      }
      for (let i = 0; i < 5; ++i) {
        if (s[i] < "0" || "9" < s[i]) {
          return false;
        }
      }
      return true;
    },
    isValidNickname() {
      const s = this.modal.input;
      const regex = /^\S.*\S$/;
      return Boolean(s.match(regex));
    },
    onClickSelectSide(side) {
      const ref = firebase.database().ref(`data/${this.roomId}`);
      console.log(ref);
      ref.update({
        [`player${side}`]: {
          assigned: true,
          id: firebase.auth().currentUser.uid,
          nickname: this.user.nickname
        }
      });
      this.$store.commit("setSide", side);
    },
    onClickHouse(index) {
      console.log("index: ", index);
      if (this.gameFinished) {
        return;
      }
      if (!this.isMyTurn) {
        return;
      }
      let houseIndex = this.$store.state.mySide * 7 + index;
      let move = { selected: houseIndex, playerSide: this.$store.state.mySide };
      if (
        isValidRoomId(this.roomId) &&
        isValidMove(this.gameBoard.entireHouses, move)
      ) {
        const ref = firebase.database().ref(`data/${this.roomId}/moves`);
        ref.push(move);
      }
    },
    onClickRematch() {
      if (this.room.ownerId !== firebase.auth().currentUser.uid) {
        return;
      }
      let path = `data/${this.roomId}`;
      const ref = firebase.database().ref(path);
      ref.update({
        status: "initialized",
        player0: {
          assigned: false,
          id: "",
          nickname: ""
        },
        player1: {
          assigned: false,
          id: "",
          nickname: ""
        },
        moves: []
      });
    }
  }
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>

<style scoped>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.header {
  background: #3ab383;
  margin-bottom: 1vh;
  padding: 2vh 2vw;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.game {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 1em;
  margin: 0vh 4vw 14vh 4vw;
}
.game-opposite-nickname {
  display: flex;
  margin-bottom: 10vh;
}
.game-board {
  height: 100%;
  width: 100%;
  display: grid;
  grid-template: 1fr / 1fr 6fr 1fr;
  align-items: center;
  padding: 0vh 0vw 0vh 0vw;
}
.game-board-opposite-scoring-house-wrapper,
.game-board-my-scoring-house-wrapper {
  height: 100%;
  align-items: center;
}
.game-board-opposite-scoring-house-wrapper {
  padding: 0vh 0vw 20vh 0vw;
}
.game-board-my-scoring-house-wrapper {
  padding: 20vh 0vw 0vh 0vw;
}
.game-board-opposite-scoring-house,
.game-board-my-scoring-house {
  height: 100%;
  border: solid 2px #333333;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7em;
}
.game-board-opposite-scoring-house {
  margin: 0vh 1vw 0vh 1vw;
}
.game-board-my-scoring-house {
  margin: 0vh 1vw 0vh 1vw;
}
.game-board-middle {
  height: 100%;
  display: grid;
  grid-template: 3fr 2fr 3fr / 1fr;
  margin: 0vh 1vw 0vh 1vw;
}
.game-board-opposite-houses,
.game-board-my-houses {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.game-board-opposite-houses {
  padding: 0vh 1vw 2vh 1vw;
}
.game-board-my-houses {
  padding: 2vh 1vw 0vh 1vw;
}
.house-wrapper {
  flex: 1;
  margin: 0vh 1vw;
  align-items: center;
  border: solid 2px #333333;
  display: flex;
  align-items: center;
  justify-content: center;
}
.house {
  flex-grow: 1fr;
  font-size: 1.5em;
}
.game-info {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
}
.game-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
}
</style>
