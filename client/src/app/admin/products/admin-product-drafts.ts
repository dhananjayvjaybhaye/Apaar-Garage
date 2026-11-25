import { Injectable } from '@angular/core';
import type { AdminImage, DraftFields } from './admin-product-types';

interface ProductDraft {
  fields: DraftFields;
  images: AdminImage[];
  glb: string;
  imageUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AdminProductDrafts {
  // Contains admin-only data. Keep drafts in memory and scoped to the signed-in account.
  private readonly drafts = new Map<string, ProductDraft>();

  read(account: string, slug: string | null) {
    return this.drafts.get(this.key(account, slug));
  }

  save(account: string, slug: string | null, draft: ProductDraft) {
    this.drafts.set(this.key(account, slug), draft);
  }

  discard(account: string, slug: string | null) {
    this.drafts.delete(this.key(account, slug));
  }

  clear() {
    this.drafts.clear();
  }

  private key(account: string, slug: string | null) {
    return JSON.stringify([account, slug]);
  }
}
