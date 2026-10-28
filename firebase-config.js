// วางค่าตั้งค่าจาก Firebase Console ตรงนี้
// (Project settings → Your apps → Web app → SDK setup and configuration → Config)
// ถ้าเว้นว่างไว้ หน้าเว็บจะเก็บข้อมูลในเบราว์เซอร์เครื่องนี้แทน
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",   // สำคัญ: ต้องมีค่านี้ เช่น https://xxx-default-rtdb.asia-southeast1.firebasedatabase.app
  projectId: "",
  appId: ""
};
