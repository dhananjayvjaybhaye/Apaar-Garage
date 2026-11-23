import type { Product } from '../../catalog/product';
import { heroScene } from '../hero.config';
import type { GarageBay } from './garage-models';

export function updateGarageEmphasis(
  bays: GarageBay[],
  index: number,
  immediate: boolean,
  hoveredProduct: Product | undefined,
) {
  bays.forEach((bay, bayIndex) => {
    const lit = bayIndex === index;
    const hovered = Boolean(
      hoveredProduct?.slug === bay.product?.slug && hoveredProduct !== undefined,
    );
    bay.focus = immediate ? Number(lit) : bay.focus + (Number(lit) - bay.focus) * 0.19;
    bay.setFocus(bay.focus);
    const brightness =
      heroScene.inactiveBrightness + bay.focus * (1 - heroScene.inactiveBrightness);
    bay.card?.material.color.setScalar(brightness);
    const intensity = heroScene.activeLight * brightness + (hovered ? heroScene.hoverLight : 0);
    bay.lightIntensity = immediate
      ? intensity
      : bay.lightIntensity + (intensity - bay.lightIntensity) * 0.19;
    if (bay.light) bay.light.intensity = bay.lightIntensity;
    bay.rail.emissiveIntensity = 0.14 + bay.lightIntensity / 26;
    const opacity = hovered ? 0.95 : lit ? 0.25 : 0.06;
    bay.halo.material.opacity = immediate
      ? opacity
      : bay.halo.material.opacity + (opacity - bay.halo.material.opacity) * 0.2;
  });
}
