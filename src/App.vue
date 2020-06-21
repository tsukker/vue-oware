<template>
  <div id="app">
    <img alt="Vue logo" src="./assets/logo.png" />

    <!-- コンポーネント MyModal -->
    <MyModal @close="closeModal" v-if="modal.visible">
      <!-- default スロットコンテンツ -->
      <p>{{ modal.message }}</p>
      <div v-if="modal.inputVisible">
        <input
          v-model="modal.input"
          pattern="[0-9]*"
          id="modal-input"
          @keydown.enter="onClickModalEnter"
          placeholder="01234"
        />
      </div>
      <!-- /default -->
      <!-- footer スロットコンテンツ -->
      <template slot="footer">
        <button type="button" @click="closeModal" style="color:#cc0000">Cancel</button>
        <button type="button" @click="onClickModalEnter">Enter</button>
      </template>
      <!-- /footer -->
    </MyModal>
  </div>
</template>

<script>
"use strict";
import MyModal from "./components/MyModal.vue";

export default {
  name: "App",
  data() {
    return {
      modal: { visible: false, message: "", inputVisible: false, input: "" }
    };
  },
  components: {
    MyModal
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
