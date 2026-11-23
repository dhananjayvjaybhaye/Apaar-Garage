// Display-case construction in Three.js world units, shared by the renderer and loading skeleton.
const shelfWidth = 4.6;
const postHeight = 3.4;

export const garageBench = {
  shelves: [
    { y: 1.02, z: -1.6, width: shelfWidth, height: 0.23, depth: 2.55 },
    { y: 3.42, z: -1.59, width: shelfWidth, height: 0.15, depth: 2.53 },
  ],
  posts: { x: 2.24, y: postHeight / 2, z: -0.38, width: 0.14, height: postHeight, depth: 0.16 },
  base: { y: 0.37, z: -1.6, width: 4.46, height: 0.12, depth: 2.41 },
  label: { y: 3.73, z: -0.48, width: 2.34, height: 0.42 },
  display: { y: 1.14, z: -1.58 },
  card: { y: 1.02, z: 0.19, width: 2.62, height: 1.94 },
  light: { y: 6.48, z: -0.35, width: 4.16, height: 0.05, depth: 0.35 },
} as const;
