import { activeZoneFill, garageHeroZones, heroScene, signTopMargin } from '../hero.config';

export const heroZones = garageHeroZones;

export function heroCameraAt(
  index: number,
  width: number,
  height: number,
  compact: boolean,
  fromIndex = index,
  phase = 1,
) {
  const target = heroZones[index];
  const from = heroZones[fromIndex];
  const ease = phase * phase * (3 - 2 * phase);
  const lookX = from.x + ease * (target.x - from.x);
  const crossing = phase === 1 || from === target ? 0 : Math.sin(phase * Math.PI);
  const frame = compact ? heroScene.compactFrame : heroScene.desktopFrame;
  const screenX = frame.x - (compact ? 0 : crossing * heroScene.crossingCenterShift);
  const aspect = width / height;
  const lens = 2 * Math.tan((heroScene.fieldOfView * Math.PI) / 360);
  const fill = compact
    ? heroScene.compactFrame.widthFill
    : activeZoneFill * heroScene.desktopFrame.openingWidth;
  const horizontalRoom = Math.min(fill / 2, 1 - screenX - heroScene.frameEdgePadding);
  const sign = heroScene.neonSign;
  const plane = heroScene.rcPlane;
  const skyRoom = Math.max(0.1, frame.y - signTopMargin / height);
  // The sign and plane sit behind the front of the case, so they need less camera distance.
  const distanceForTop = (y: number, z: number) =>
    (y - heroScene.cameraTargetY + heroScene.framingClearance) / (lens * skyRoom) +
    z -
    heroScene.caseFront;
  const distance = Math.max(
    heroScene.caseHeight / (lens * frame.heightFill),
    heroScene.caseHalfWidth / (lens * aspect * horizontalRoom),
    distanceForTop(sign.y + sign.height / 2, sign.z),
    distanceForTop(plane.top, plane.front),
  );
  return {
    x: lookX + heroScene.cameraSide,
    y: heroScene.cameraTargetY + heroScene.cameraRise,
    // The forward push ends at the exact configured framing for the selected zone.
    z: heroScene.caseFront + distance - crossing * heroScene.crossingDolly,
    lookX,
    lookY: heroScene.cameraTargetY,
    lookZ: heroScene.caseFront,
    signX: lookX + (compact ? sign.compactXOffset : sign.xOffset),
    screenX,
    screenY: frame.y,
  };
}
