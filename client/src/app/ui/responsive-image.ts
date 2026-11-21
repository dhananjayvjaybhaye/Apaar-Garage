const localPhotos = /^\/images\/(?:editorial\/)?(?:car|truck|bike)\.jpg$/;

export function responsiveImage(source: string): string | null {
  if (!localPhotos.test(source)) return null;
  const photo = source.slice(0, -4);
  return photo + '-320.webp 320w, ' + photo + '-640.webp 640w';
}
