import { SERVER_URL } from '../apiConfig';

export const getProfileImageSource = (url) => {
  if (!url || typeof url !== 'string') {
    return require('../assets/default_avatar.png');
  }
  if (url.startsWith('http') || url.startsWith('file')) {
    return url;
  }
  const fullUrl = url.startsWith('/') ? `${SERVER_URL}${url}` : `${SERVER_URL}/${url}`;
  return `${fullUrl}?t=${new Date().getTime()}`;
};