import { getDatabase } from "firebase/database";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; 

const firebaseConfig = {
  apiKey: "AIzaSyB0EJr7Gdh9FVpwdb1S9nM0E53JiNSG8fM",
  authDomain: "smartwatersystem-f6ea9.firebaseapp.com",
  databaseURL: "https://smartwatersystem-f6ea9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smartwatersystem-f6ea9",
  storageBucket: "smartwatersystem-f6ea9.firebasestorage.app",
  messagingSenderId: "825733986832",
  appId: "1:825733986832:web:24c072da1546df81f36895"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const auth = getAuth(app); 
export const db = getDatabase(app);