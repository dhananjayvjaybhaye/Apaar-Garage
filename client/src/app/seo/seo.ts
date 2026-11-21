import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { metadataTags, pageMetadata, structuredData, type SeoProduct } from './metadata.mjs';

@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly product = signal<SeoProduct | undefined>(undefined);
  private readonly location = this.document.location;
  private readonly address = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.location?.href ?? '/' },
  );

  constructor() {
    effect(() => {
      const origin =
        this.document.querySelector<HTMLMetaElement>('meta[name="storefront-origin"]')?.content ||
        this.location?.origin;
      if (!origin || !/^https?:\/\//.test(origin)) return;
      const address = this.address();
      const product = this.product();
      const info = pageMetadata(address, origin, product);
      this.title.setTitle(info.title);
      for (const [kind, key, content] of metadataTags(info)) {
        this.meta.updateTag({ [kind]: key, content }, kind + '="' + key + '"');
      }
      this.headNode('link', 'link[rel="canonical"]').setAttribute('rel', 'canonical');
      this.document.querySelector('link[rel="canonical"]')?.setAttribute('href', info.canonical);
      if (!info.graph.length) {
        this.document.querySelector('#store-structured-data')?.remove();
        return;
      }
      const script = this.headNode('script', '#store-structured-data');
      script.id = 'store-structured-data';
      script.setAttribute('type', 'application/ld+json');
      script.textContent = structuredData(info.graph);
    });
  }

  setProduct(product: SeoProduct) {
    this.product.set(product);
  }

  private headNode(tag: 'link' | 'script', selector: string) {
    const existing = this.document.head.querySelector(selector);
    if (existing) return existing;
    return this.document.head.appendChild(this.document.createElement(tag));
  }
}
