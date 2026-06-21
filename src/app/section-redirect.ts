import { redirect } from 'next/navigation';

const homeSections = new Set(['home', 'video', 'image', 'smart', 'media', 'film', 'tasks', 'settings']);
const mediaSections = new Set(['assets', 'image', 'poster', 'copywriting', 'xiaohongshu', 'wechat', 'douyin']);

export function redirectToHomeSection(section: string, media?: string) {
  if (!homeSections.has(section)) {
    redirect('/');
  }

  const params = new URLSearchParams({ section });
  if (media && mediaSections.has(media)) {
    params.set('media', media);
  }

  redirect(`/?${params.toString()}`);
}
