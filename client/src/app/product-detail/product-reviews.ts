import { AmbientVisible } from '../motion/ambient-visible';
import { DatePipe } from '@angular/common';
import { HttpClient, httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { apiMessage } from '../api-message';
import type { RatingSummary } from '../catalog/product';
import { AuthStore } from '../auth/auth-store';

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
}
interface ReviewPage {
  page: number;
  totalPages: number;
  items: Review[];
}

@Component({
  selector: 'app-product-reviews',
  imports: [AmbientVisible, DatePipe, FormsModule],
  templateUrl: './product-reviews.html',
  styleUrl: './product-reviews.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductReviews {
  readonly slug = input.required<string>();
  readonly submitted = output<RatingSummary>();

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private readonly url = () => '/api/products/' + encodeURIComponent(this.slug());
  protected readonly page = linkedSignal({ source: this.slug, computation: () => 1 });
  protected readonly rating = linkedSignal({ source: this.slug, computation: () => 0 });
  protected readonly comment = linkedSignal({ source: this.slug, computation: () => '' });
  protected readonly error = signal('');
  protected readonly pending = signal(false);
  protected readonly posted = linkedSignal({ source: this.slug, computation: () => false });
  protected readonly choices = [5, 4, 3, 2, 1];

  protected readonly reviews = httpResource<ReviewPage>(() => ({
    url: this.url() + '/reviews',
    params: { page: this.page() },
  }));
  protected readonly access = httpResource<{ canReview: boolean; reviewed: boolean }>(() => {
    const status = this.auth.status();
    if (status === 'checking') return undefined;
    return { url: this.url() + '/review-access' };
  });

  protected async submit() {
    this.error.set('');
    if (this.pending() || !this.access.hasValue() || !this.access.value().canReview || this.posted()) return;
    const rating = Number(this.rating());
    const comment = this.comment().trim();
    if (!rating || !comment) {
      this.error.set('Select a star rating and write a short review.');
      return;
    }
    const slug = this.slug();
    this.pending.set(true);
    try {
      const summary = await firstValueFrom(this.http.post<RatingSummary>(this.url() + '/reviews', { rating, comment }));
      if (this.slug() !== slug) return;
      this.posted.set(true);
      this.submitted.emit(summary);
      if (this.page() === 1) this.reviews.reload();
      else this.page.set(1);
      this.access.reload();
    } catch (error) {
      if (this.slug() !== slug) return;
      this.error.set(apiMessage(error, 'Your review couldn’t be saved. Try again.'));
      this.access.reload();
    } finally { this.pending.set(false); }
  }
}
