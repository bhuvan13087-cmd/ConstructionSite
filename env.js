/**
 * Multi-Tenant Firebase Connection Configuration
 * Contains registered customer projects for the application.
 */

export const PROJECT_CONFIGS = {
  customer1: {
    id: "customer1",
    name: "Civil Construction Site 1",
    shortName: "Project 1",
    apiKey: "AIzaSyCwmOam1UHhAzZJNg7Jiuha1lcOy0qlwA8",
    googleMapsApiKey: "AIzaSyC738UrEsuIru8YsGJBayjvJGqK-s332Zg",
    authDomain: "studio-7044154747-fb0fa.firebaseapp.com",
    projectId: "studio-7044154747-fb0fa",
    storageBucket: "studio-7044154747-fb0fa.firebasestorage.app",
    messagingSenderId: "201376845036",
    appId: "1:201376845036:web:d50fb937ecc740e480e9c9",
    defaultAdminEmail: "admin@gmail.com"
  },
  customer2: {
    id: "customer2",
    name: "Civil Construction Site 2",
    shortName: "Project 2",
    apiKey: "AIzaSyB2P-B08Zg8aAaAJaNeg57fhCGvFJmrK24",
    googleMapsApiKey: "AIzaSyB2P-B08Zg8aAaAJaNeg57fhCGvFJmrK24",
    authDomain: "civilconstructionsite2.firebaseapp.com",
    projectId: "civilconstructionsite2",
    storageBucket: "civilconstructionsite2.firebasestorage.app",
    messagingSenderId: "86404894185",
    appId: "1:86404894185:web:ac69fc24d500391b09cf78",
    defaultAdminEmail: "admin2@gmail.com"
  }
};

// Default active fallback is Project 1
export const firebaseConfig = PROJECT_CONFIGS.customer1;
