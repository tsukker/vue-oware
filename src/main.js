"use strict";

import Vue from 'vue'
import App from './App.vue'
import firebase from 'firebase'
import { firebaseConfig } from './firebaseConfig.js'  // See README.md
import store from './store'

Vue.config.productionTip = false;

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
firebase.analytics();

new Vue({
  store,
  render: h => h(App),
  mounted: function () {
    document.title = "Oware Online";
  }
}).$mount('#app');
