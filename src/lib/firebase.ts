import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, remove, update, query, orderByChild, equalTo, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCP5bfue5FOc0eTO4E52-0A0w3PppO3Mvw",
  authDomain: "rs-anime.firebaseapp.com",
  databaseURL: "https://rs-anime-default-rtdb.firebaseio.com",
  projectId: "rs-anime",
  storageBucket: "rs-anime.firebasestorage.app",
  messagingSenderId: "843989457516",
  appId: "1:843989457516:web:57e0577d092183eedd9649"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export { ref, onValue, push, set, remove, update, query, orderByChild, equalTo, get };
