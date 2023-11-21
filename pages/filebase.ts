// Import the functions you need from the SDKs you need
import {initializeApp} from "@firebase/app";
import { getAuth, connectAuthEmulator } from "@firebase/auth";
import axios from "axios";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCB-kgiuALdZpvM4WXJsnbkFd_zyOA_cJE",
    authDomain: "openid3-bbd1b.firebaseapp.com",
    databaseURL: "https://openid3-bbd1b-default-rtdb.firebaseio.com",
    projectId: "openid3-bbd1b",
    storageBucket: "openid3-bbd1b.appspot.com",
    messagingSenderId: "281794963795",
    appId: "1:281794963795:web:5c8162bc9320b5af7819a6",
    measurementId: "G-96WRSSJ7JL"
};

export const app = initializeApp(firebaseConfig);

const URL_PREFIX = "https://us-central1-openid3-bbd1b.cloudfunctions.net/";
const LOCAL_URL_PREFIX = "http://localhost:5001/openid3-bbd1b/us-central1/";

if (process.env.NEXT_PUBLIC_DEV === "development") {
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://localhost:9099");
}

export const callFirebaseFunction = async (
  func: string,
  data: any,
  token?: string
) => {
  let url = process.env.NEXT_PUBLIC_DEV === "development" ? LOCAL_URL_PREFIX : URL_PREFIX;
  const config = token ? { headers: { authorization: "Bearer " + token } } : {};
  return axios.post(url + func, data, config);
};
