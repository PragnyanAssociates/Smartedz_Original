// src/utils/storage.js

const storage = {
  // Sets a value in LocalStorage and returns a Promise
  set: (key, value) => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  },

  // Retrieves a value from LocalStorage as a Promise
  get: (key) => {
    return Promise.resolve(localStorage.getItem(key));
  },

  // Removes a single key
  remove: (key) => {
    localStorage.removeItem(key);
    return Promise.resolve();
  },

  // Removes multiple keys at once
  multiRemove: (keys) => {
    keys.forEach((key) => localStorage.removeItem(key));
    return Promise.resolve();
  },

  // Clears all storage
  clear: () => {
    localStorage.clear();
    return Promise.resolve();
  }
};

export default storage;