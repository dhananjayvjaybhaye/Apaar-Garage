// Fictional diecast listings with generated artwork. Replace sample images with real product photos.
import { sampleCompliance } from './sample-compliance.js';
import { placeholderPath } from './placeholder-path.js';

const items = [
  {
    featured: true,
    name: 'Midnight Touring Coupe',
    slug: 'nissan-skyline-gt-r-r34',
    category: 'car',
    brand: 'Display Series',
    scale: '1:64',
    price: 1599,
    stock: 14,
    glbUrl: '/images/models/Sports%20Car%20by%20Quaternius%20-%20Gzj704DXdr.glb',
    description:
      'A low-slung touring coupe with deep graphite paint, a tall rear wing, and dark alloy-style wheels.',
  },
  {
    featured: false,
    name: 'Copperline Track Coupe',
    slug: 'porsche-911-gt3-rs',
    category: 'car',
    brand: 'Circuit Series',
    scale: '1:24',
    price: 2799,
    stock: 8,
    description:
      'A copper track coupe with wide arches, an exposed rear wing, and a black splitter.',
  },
  {
    featured: false,
    name: 'Prairie Fastback 68',
    slug: 'ford-mustang-boss-429',
    category: 'car',
    brand: 'Heritage Series',
    scale: '1:24',
    price: 2499,
    stock: 6,
    description:
      'A long-hood fastback with a raised bonnet scoop, cream side stripes, and sculpted rear haunches.',
  },
  {
    featured: false,
    name: 'Seabright Grand Touring',
    slug: 'toyota-supra-mk4',
    category: 'car',
    brand: 'Display Series',
    scale: '1:64',
    price: 699,
    stock: 18,
    description:
      'A teal grand tourer with a rounded roofline, wide rear lamps, and a short spoiler.',
  },
  {
    featured: true,
    name: 'Iron Pass Cab-Over',
    slug: 'kenworth-k100',
    category: 'truck',
    brand: 'Utility Series',
    scale: '1:64',
    price: 1999,
    stock: 9,
    description:
      'A boxy cab-over tractor with twin exhausts, ribbed steps, and a separate fifth-wheel plate.',
  },
  {
    featured: false,
    name: 'Mesa Road Sleeper',
    slug: 'peterbilt-379',
    category: 'truck',
    brand: 'Highway Series',
    scale: '1:64',
    price: 3499,
    stock: 5,
    description:
      'A long-nose highway tractor with a sleeper cab, twin fuel tanks, and a detailed rear frame.',
  },
  {
    featured: false,
    name: 'Red Quarry Tipper',
    slug: 'mack-granite-dump-truck',
    category: 'truck',
    brand: 'Utility Series',
    scale: '1:50',
    price: 3999,
    stock: 4,
    description: 'A jobsite tipper with a ribbed bed, tall sidewalls, and tandem rear axles.',
  },
  {
    featured: false,
    name: 'Lakeside Stepside Pickup',
    slug: 'chevrolet-c10-stepside',
    category: 'truck',
    brand: 'Heritage Series',
    scale: '1:64',
    price: 1299,
    stock: 11,
    description:
      'A short-bed pickup with rounded rear fenders and a contrasting bench-seat interior.',
  },
  {
    featured: true,
    name: 'Carbon Lane Track Bike',
    slug: 'kawasaki-ninja-h2r',
    category: 'bike',
    brand: 'Circuit Series',
    scale: '1:12',
    price: 2199,
    stock: 10,
    description:
      'A black track motorcycle with angular fairings, small winglets, and a compact rear cowl.',
  },
  {
    featured: false,
    name: 'Emberline Sport Bike',
    slug: 'ducati-panigale-v4',
    category: 'bike',
    brand: 'Circuit Series',
    scale: '1:12',
    price: 2099,
    stock: 7,
    description:
      'A red sport bike with low clip-on bars, twin front brake discs, and a sculpted side fairing.',
  },
  {
    featured: false,
    name: 'Highland Trail Tourer',
    slug: 'bmw-r-1250-gs',
    category: 'bike',
    brand: 'Adventure Series',
    scale: '1:18',
    price: 1499,
    stock: 0,
    description:
      'An upright touring motorcycle with a tall screen, spoked wheels, and a rear luggage rack.',
  },
  {
    featured: false,
    name: 'Frost Point Race Bike',
    slug: 'yamaha-yzf-r1',
    category: 'bike',
    brand: 'Display Series',
    scale: '1:12',
    price: 1799,
    stock: 12,
    description:
      'A white race replica with a full front fairing, dark wheels, and a narrow raised tail.',
  },
];

export const seedProducts = items.map((item) => ({
  ...item,
  ...sampleCompliance(item),
  placeholder: true,
  images: [placeholderPath(item.name)],
}));
