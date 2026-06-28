export const generateSlug = (title: string) => {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export const getAnimeUrl = (id: string | number, title?: string) => {
  if (!title) return `/anime/${id}`;
  const slug = generateSlug(title);
  if (!slug) return `/anime/${id}`;
  return `/anime/${id}/${slug}`;
};

export const getWatchUrl = (id: string | number, episode: string | number, title?: string) => {
  if (!title) return `/watch/${id}/${episode}`;
  const slug = generateSlug(title);
  if (!slug) return `/watch/${id}/${episode}`;
  return `/watch/${id}/${slug}/${episode}`;
};
