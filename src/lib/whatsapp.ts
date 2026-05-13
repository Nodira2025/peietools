export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export const buildWhatsAppLink = (phone: string, message: string): string => {
  // Remove non-numeric characters from the phone number
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};
