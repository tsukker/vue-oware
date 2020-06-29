<template>
  <div id="app">
    <header class="header">
      <h1>Oware</h1>
      <section class="auth">
        <!-- ログイン時にはフォームとログアウトボタンを表示 -->
        <div v-if="userLoggedin" key="login">
          [
          <a href="javascript:void(0)" @click.prevent="onClickUserName">{{ this.user.nickname }}</a> ]
          <button type="button" @click="doLogout">Log out</button>
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
import { generateRandomRoomId, isValidRoomId } from "./utility.js";

export default {
  name: "App",
  components: {
    MyModal
  },
  data() {
    return {
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
      roomId: "",
      user: {},
      room: {}
    };
  },
  computed: {
    userLoggedin: function() {
      return this.user && this.user.uid;
    },
    modalEnterDisabled: function() {
      return !this.modal.isValidInput();
    }
  },
  created() {
    firebase.auth().onAuthStateChanged(user => {
      this.user = user ? user : {};
      if (this.userLoggedin) {
        console.log("user: ", user);
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
        owner: firebase.auth().currentUser.uid,
        roomId: roomId
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
                (!val.owner || val.owner !== firebase.auth().currentUser.uid)
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
      const ref = firebase.database().ref(`data/${roomId}/moves`);
      ref.limitToLast(10).on("child_added", this.moveAdded);
      console.log("ref registered: " + `data/${roomId}/moves`);
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
      const ref = firebase.database().ref(`data/${roomId}/moves`);
      ref.limitToLast(10).off("child_added", this.moveAdded);
      console.log("ref un-registered: " + `data/${roomId}/moves`);
      this.roomId = "";
      this.chat = [];
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
      console.log("val: ", val);
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
</style>
