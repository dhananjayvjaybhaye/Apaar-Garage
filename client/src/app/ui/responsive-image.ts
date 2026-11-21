const localPhotos = /^\/images\/(?:editorial\/)?(?:car|truck|bike)\.jpg$/;

export function responsiveImage(source: string): string | null {
  if (source === '/images/rc-sample.png') {
    return '/images/rc-sample-320.webp 320w, /images/rc-sample-640.webp 640w';
  }
  if (!localPhotos.test(source)) return null;
  const photo = source.slice(0, -4);
  return photo + '-320.webp 320w, ' + photo + '-640.webp 640w';
}
