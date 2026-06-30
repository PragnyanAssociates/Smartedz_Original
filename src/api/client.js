// 📂 File: src/api/client.js (FINAL, WEB VERSION)

import axios from "axios";
import storage from "../utils/storage";
// ★★★ 1. IMPORT THE CORRECT, LIVE URL FROM YOUR CENTRAL CONFIG FILE ★★★
import { API_BASE_URL } from "../apiConfig"; // adjust path if apiConfig.js is at project root

// Create a special, pre-configured instance of axios.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// This interceptor runs automatically BEFORE any API request is sent.
//
//  ⚠ Token source: the app's window.fetch interceptor (AuthContext) attaches
//  the JWT from localStorage under the key "smartedz_token". This axios
//  client must use the SAME token or every axios call (the whole group-chat
//  module) goes out with no Authorization header and is rejected 401 by the
//  /api gate. We read "smartedz_token" from localStorage first (the known-good
//  source), then fall back to the storage util under both key names so nothing
//  breaks regardless of where the token actually lives.
apiClient.interceptors.request.use(
  async (config) => {
    try {
      let token = null;

      // 1. Primary: the exact key/source the working fetch interceptor uses.
      try {
        if (typeof localStorage !== "undefined") {
          token = localStorage.getItem("smartedz_token");
        }
      } catch (_) {}

      // 2. Fallbacks via the storage util (in case it's kept there instead).
      if (!token) {
        try { token = await storage.get("smartedz_token"); } catch (_) {}
      }
      if (!token) {
        try { token = await storage.get("userToken"); } catch (_) {}
      }

      // 3. If a token was found, attach it to the Authorization header.
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error("Error fetching token from storage:", err);
    }

    // 4. Return the updated request config so the call can proceed.
    return config;
  },
  (error) => {
    // Handle errors before the request is sent
    return Promise.reject(error);
  }
);

// ✅ Export only the configured axios client
export default apiClient;