import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
  console.log('[Polyfills] Crypto polyfill loaded successfully');
} else {
  console.warn('[Polyfills] WARNING: Crypto polyfill may not be available');
}

if (typeof URL !== 'undefined') {
  console.log('[Polyfills] URL polyfill loaded successfully');
} else {
  console.warn('[Polyfills] WARNING: URL polyfill may not be available');
}
