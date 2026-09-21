import { io } from 'socket.io-client';
import { isDemo } from './api';
const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
// One shared socket for the whole app. It authenticates with the same HttpOnly session cookie as the API,
// so it must reconnect whenever the signed-in user changes (see AppProvider).
export const socket = isDemo ? null : io(base || undefined, { autoConnect: false, withCredentials: true, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 });
export const connectRealtime = () => { if (socket && !socket.connected) socket.connect(); };
export const reauthRealtime = () => { if (!socket) return; socket.disconnect(); socket.connect(); };
export const toBytes = data => data instanceof Uint8Array ? data : new Uint8Array(data);
