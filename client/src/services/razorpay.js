import { ApiError } from './errors';
const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let pending = null;
/** Loads the gateway's checkout script once, on the first attempt to pay rather than on page load. */
export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  pending ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SRC; script.async = true;
    script.onload = () => window.Razorpay ? resolve(window.Razorpay) : reject(new ApiError('The payment window did not load. Please try again.', { code: 'CHECKOUT_UNAVAILABLE' }));
    script.onerror = () => { pending = null; reject(new ApiError('Could not load the payment window. Check your connection and try again.', { code: 'CHECKOUT_UNAVAILABLE' })); };
    document.head.appendChild(script);
  });
  return pending;
}
