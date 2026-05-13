// export const SERVER_URL = 'https://vpsngo-production-16c3.up.railway.app'; 

// // This URL is for your API calls
// export const API_BASE_URL = 'https://vpsngo-production-16c3.up.railway.app/api'; 


// ✅ CORRECT (AFTER)
const PUBLIC_BACKEND_URL = 'https://vivekanandapublicschoolweblessonplan-production.up.railway.app';

// This URL is for static files like images
export const SERVER_URL = PUBLIC_BACKEND_URL; 

// This URL is for your API calls
export const API_BASE_URL = `${PUBLIC_BACKEND_URL}/api`;