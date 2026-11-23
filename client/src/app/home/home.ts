import { Tilt } from '../motion/tilt';
import { Magnetic } from '../motion/magnetic';
import { Parallax } from '../motion/parallax';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, filter, firstValueFrom, map, merge, of, startWith, Subject, switchMap, take } from 'rxjs';
import { apiMessage } from '../api-message';
import { CatalogApi } from '../catalog/catalog-api';
import type { Product } from '../catalog/product';
import { ProductCard } from '../catalog/product-card';
import { Reveal } from '../reveal';
import { ShopState } from '../ui/shop-state';
import { responsiveImage } from '../ui/responsive-image';
import { HomeHero } from './home-hero';
import type { GarageZone } from './garage/garage-path';
import { GarageIntro } from './garage/garage-intro';
import { GarageAmbience } from '../ui/garage-ambience';
import { TrackDivider } from '../ui/track-divider';
import { ScrollVehicles } from '../motion/scroll-vehicles';
import { AmbientVisible } from '../motion/ambient-visible';
import { CategoryStages } from './category-stages';
import { categoryScenes } from './category-scenes.config';
import { HomeArrivals } from './home-arrivals';
import { HomeAssurance } from './home-assurance';
import { AfterFirstPaint } from '../ui/after-first-paint';
import { loadRcZone } from './home-rc-zone';
import type { RcBenchStatus } from './garage/garage-path';

type FeaturedState = { loading: boolean; items: Product[]; bench?: Product; error?: boolean };
const loading: FeaturedState = { loading: true, items: [] };

@Component({
  selector: 'app-home',
  imports: [Tilt, Magnetic, Parallax, RouterLink, HomeHero, GarageIntro, CategoryStages, ProductCard, Reveal, ShopState, GarageAmbience, TrackDivider, ScrollVehicles, AmbientVisible, HomeArrivals, HomeAssurance],
  templateUrl: './home.html',
  styleUrls: ['./home.css', './home-motion.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly api = inject(CatalogApi);
  private readonly http = inject(HttpClient);
  protected readonly imageSet = responsiveImage;
  private readonly featuredRequest = new Subject<GarageZone>();
  private readonly paint = inject(AfterFirstPaint);
  private readonly secondaryReady = toObservable(this.paint.ready).pipe(filter(Boolean));
  private readonly zoneSelected = new Subject<GarageZone>();
  protected readonly category = signal<GarageZone>('car');
  protected readonly signupInvalid = signal(false);
  protected readonly signupPending = signal(false);
  protected readonly signupStatus = signal<{ text: string; failed?: boolean } | null>(null);
  private readonly featuredByCategory = {
    car: this.loadFeatured('car'), truck: this.loadFeatured('truck'), bike: this.loadFeatured('bike'), rc: this.loadFeatured('rc'),
  };
  protected readonly featured = computed(() => this.featuredByCategory[this.category()]());
  protected readonly garageProducts = computed(() => Object.values(this.featuredByCategory)
    .map((result) => result().bench).filter((item) => item !== undefined));
  protected readonly rcBenchStatus = computed<RcBenchStatus>(() => {
    const rc = this.featuredByCategory.rc();
    return rc.loading ? 'loading' : rc.error ? 'unavailable' : 'ready';
  });

  protected readonly categories = [
    {
      id: 'car',
      name: 'Cars',
      note: 'Street icons and track legends',
      image: '/images/editorial/car.jpg',
      imageAlt: 'Diecast sports cars on a display shelf',
    },
    {
      id: 'truck',
      name: 'Trucks',
      note: 'Heavy haulers and classic pickups',
      image: '/images/editorial/truck.jpg',
      imageAlt: 'Diecast trucks in a workshop display',
    },
    {
      id: 'bike',
      name: 'Bikes',
      note: 'Sport bikes and road machines',
      image: '/images/editorial/bike.jpg',
      imageAlt: 'Scale motorcycle models on a dark shelf',
    },
    {
      id: 'rc',
      name: 'RC Toys',
      note: 'RC rides, aircraft and accessories',
      image: '/images/rc-sample.png',
      imageAlt: 'Illustration of a remote-control handset',
    },
  ] as const;
  protected readonly categoryName = computed(() => this.categories.find(({ id }) => id === this.category())?.name ?? '');
  protected readonly categoryStages = computed(() => this.categories.map(({ id, name, note }) => {
    const state = this.featuredByCategory[id]();
    return { id, name, note, ...state };
  }));
  protected readonly scales = ['1:18', '1:24', '1:43', '1:64'];

  protected selectCategory(category: GarageZone) {
    this.category.set(category);
    this.zoneSelected.next(category);
  }

  protected retryFeatured() {
    this.featuredRequest.next(this.category());
  }

  private loadFeatured(category: GarageZone) {
    const matching = (requested: GarageZone) => requested === category;
    const initial = category === 'car' ? of(category) : merge(
      this.secondaryReady.pipe(map(() => category)),
      this.zoneSelected.pipe(filter(matching)),
    ).pipe(take(1));
    return toSignal(merge(initial, this.featuredRequest.pipe(filter(matching))).pipe(
      switchMap(() => (category === 'rc'
        ? loadRcZone(this.api, categoryScenes.productLimit)
        : this.api.getProducts({ category, sort: 'featured', limit: categoryScenes.productLimit }).pipe(
            map(({ items }) => ({ items, bench: items[0] })),
          )).pipe(
        map(({ items, bench }): FeaturedState => ({ loading: false, items, bench })),
        catchError(() => of<FeaturedState>({ loading: false, items: [], error: true })),
        startWith(loading),
      )),
    ), { initialValue: loading });
  }

  protected async subscribe(event: Event, input: HTMLInputElement) {
    event.preventDefault();
    if (this.signupPending()) return;
    if (!input.validity.valid || !input.value.trim()) {
      this.signupInvalid.set(true);
      input.focus();
      return;
    }
    this.signupInvalid.set(false);
    this.signupPending.set(true);
    this.signupStatus.set(null);
    try {
      await firstValueFrom(this.http.post('/api/newsletter', { email: input.value.trim() }));
      input.value = '';
      this.signupStatus.set({ text: 'You’re on the list.' });
    } catch (error) {
      this.signupStatus.set({
        text: apiMessage(error, 'Could not save your signup. Try again.'),
        failed: true,
      });
    } finally {
      this.signupPending.set(false);
    }
  }
}
