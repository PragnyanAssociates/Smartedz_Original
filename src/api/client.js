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
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // 1. Get the user's token from storage.
      const token = await storage.get("userToken");

      // 2. If token exists, attach it to the Authorization header.
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error("Error fetching token from storage:", err);
    }

    // 3. Return the updated request config so the call can proceed.
    return config;
  },
  (error) => {
    // Handle errors before the request is sent
    return Promise.reject(error);
  }
);

// ❌ Remove hardcoded base URL export
// export { API_BASE_URL }; <-- DELETE THIS

// ✅ Export only the configured axios client
export default apiClient;