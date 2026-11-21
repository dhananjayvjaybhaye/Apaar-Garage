import { Injectable } from '@angular/core';

// The hero and tour lease one garage canvas. A new lease releases the previous context first.
@Injectable()
export class GarageCanvasSlot {
  private owner?: () => void;

  claim(dispose: () => void) {
    if (this.owner !== dispose) this.owner?.();
    this.owner = dispose;
    return () => {
      if (this.owner === dispose) this.owner = undefined;
    };
  }
}
