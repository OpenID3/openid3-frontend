// Import the functions you need from the SDKs you need
import {initializeApp} from "@firebase/app";
import {getAnalytics} from "@firebase/analytics";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

export {
    app
}
