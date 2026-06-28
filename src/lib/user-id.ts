const USER_ID_KEY = 'cerydra_user_id';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  // Set cookie for Astro SSR to read initialTime
  if (!document.cookie.includes(`${USER_ID_KEY}=${id}`)) {
    document.cookie = `${USER_ID_KEY}=${id}; path=/; max-age=31536000`;
  }
  return id;
}
