// Shared by Angular navigation and the static SEO build.
const store = 'Apaar Garage';
const schema = 'https://schema.org';
const shareImage = '/images/share-garage.jpg';

export const publicPages = {
  '/seller-information': ['Seller information', 'Find seller details, customer care, and the grievance contact for Apaar Garage.'],
  '/contact': ['Contact and complaints', 'Send a support ticket or track your complaint.'],
  '/': [
    store + ' | Diecast Collectibles & RC Toys',
    'Explore diecast cars, trucks and bikes, plus radio-controlled vehicles, aircraft and accessories.',
  ],
  '/catalog': [
    'The Collection',
    'Browse diecast collectibles and RC toys. Compare categories, brands, scales and prices.',
  ],
  '/faq': [
    'FAQ and support',
    'Find answers about delivery, Cash on Delivery, returns, model scales, RC safety and tracking.',
  ],
  '/about': [
    'About Apaar Garage',
    'Learn about Apaar Garage and its collection of scale models and radio-controlled toys.',
  ],
  '/policies/privacy': [
    'Privacy policy',
    'Learn how Apaar Garage handles account, order, contact and browser information.',
  ],
  '/policies/shipping': [
    'Shipping policy',
    'Check delivery estimates, packaging, Cash on Delivery and shipment tracking.',
  ],
  '/policies/returns': [
    'Returns policy',
    'Find out how to request a return or cancel an eligible Apaar Garage order.',
  ],
  '/policies/terms': [
    'Store terms',
    'Read the store terms for orders, availability, discounts and verified buyer reviews.',
  ],
};
const privatePages = {
  '/admin': ['Admin dashboard', 'Administrator access for Apaar Garage.'],
  '/admin/login': ['Admin sign-in', 'Administrator sign-in for Apaar Garage.'],
  '/newsletter/unsubscribe': ['Newsletter unsubscribe', 'Manage your Apaar Garage newsletter subscription.'],
  '/account/privacy': ['Account privacy', 'Manage your Apaar Garage account data.'],
  '/login': ['Sign in', 'Sign in to access your account and order history.'],
  '/register': ['Create an account', 'Create an account to save your wishlist and track orders.'],
  '/cart': ['Your cart', 'Review your selected models and quantities before checkout.'],
  '/checkout': [
    'Checkout',
    'Review your shipping details before placing a Cash on Delivery order.',
  ],
  '/checkout/success': ['Order received', 'Find your order confirmation and tracking information.'],
  '/orders': ['Order history', 'Review your previous orders and track their delivery.'],
  '/track-order': ['Track order', 'Check the latest status of your Apaar Garage order.'],
  '/wishlist': ['Wishlist', 'View the diecast models and RC toys you have saved.'],
};
export const seoCategories = {
  car: 'Diecast Cars',
  truck: 'Diecast Trucks',
  bike: 'Diecast Bikes',
  'rc-car': 'RC Cars',
  'rc-truck': 'RC Trucks',
  'rc-plane': 'RC Planes',
  'rc-boat': 'RC Boats',
  'rc-drone': 'RC Drones',
  'rc-bike': 'RC Bikes',
  'rc-accessory': 'RC Accessories',
};

export function siteOrigin(value) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Use an HTTP(S) site origin without a path, query, or credentials.');
  }
  return url.origin;
}

function imageUrl(source, origin) {
  if (source) {
    try {
      const url = new URL(source, origin);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password)
        return url.href;
    } catch {
      /* Use the default image for invalid URLs. */
    }
  }
  return new URL(shareImage, origin).href;
}

function breadcrumbs(items, origin) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: new URL(path, origin).href,
    })),
  };
}

export function pageMetadata(address, origin, product) {
  const route = new URL(address, origin);
  const path = route.pathname.replace(/\/+$/, '') || '/';
  const graph = [];
  let canonicalPath = path;
  let indexable = Object.hasOwn(publicPages, path);
  let [title, description] = indexable
    ? publicPages[path]
    : ['Page not found', 'Find the diecast and RC collections at Apaar Garage.'];
  let type = 'website';
  let image = imageUrl(undefined, origin);
  if (path === '/') {
    graph.push({ '@type': 'Organization', name: store, url: new URL('/', origin).href });
  } else if (path === '/catalog') {
    const category = route.searchParams.get('category');
    const kind = route.searchParams.get('productType');
    if (
      Object.hasOwn(seoCategories, category) &&
      (!kind || kind === (category.startsWith('rc-') ? 'rc' : 'diecast'))
    ) {
      title = seoCategories[category];
      description = 'Shop ' + title + ' at Apaar Garage. Compare models, prices and availability.';
      canonicalPath += '?category=' + category;
    } else if (kind === 'rc' || kind === 'diecast') {
      title = kind === 'rc' ? 'RC Toys' : 'Diecast Models';
      description = 'Explore ' + title + ' at Apaar Garage and find a model for your collection.';
      canonicalPath += '?productType=' + kind;
    }
    const trail = [
      ['Home', '/'],
      ['The Collection', '/catalog'],
    ];
    if (canonicalPath !== path) trail.push([title, canonicalPath]);
    graph.push(breadcrumbs(trail, origin));
  } else if (path.startsWith('/product/')) {
    title = 'Product details';
    description = 'See photos, specifications, and availability for this Apaar Garage model.';
    if (product && path === '/product/' + encodeURIComponent(product.slug)) {
      title = product.name;
      description = product.description;
      indexable = true;
      type = 'product';
      const productImage = imageUrl(product.images?.[0], origin);
      image =
        product.placeholder || /\.svg(?:$|\?)/i.test(productImage)
          ? imageUrl(undefined, origin)
          : productImage;
      const trail = [
        ['Home', '/'],
        ['The Collection', '/catalog'],
      ];
      if (Object.hasOwn(seoCategories, product.category)) {
        trail.push([seoCategories[product.category], '/catalog?category=' + product.category]);
      }
      graph.push(breadcrumbs([...trail, [title, path]], origin), {
        '@type': 'Product',
        name: product.name,
        image: productImage,
        description,
        brand: { '@type': 'Brand', name: product.brand },
        offers: {
          '@type': 'Offer',
          url: new URL(path, origin).href,
          price: product.price,
          priceCurrency: 'INR',
          availability: schema + (product.stock > 0 ? '/InStock' : '/OutOfStock'),
        },
      });
    }
  } else if (path.startsWith('/track-order/') || path.startsWith('/checkout/success/')) {
    canonicalPath = path.startsWith('/track-order/') ? '/track-order' : '/checkout/success';
    [title, description] = privatePages[canonicalPath];
  } else if (Object.hasOwn(privatePages, path)) {
    [title, description] = privatePages[path];
  }
  return {
    title: path === '/' ? title : title + ' | ' + store,
    description: description.replace(/\s+/g, ' ').trim(),
    image,
    canonical: new URL(canonicalPath, origin).href,
    type,
    indexable,
    graph,
  };
}

export function metadataTags(info) {
  return [
    ['name', 'description', info.description],
    ['name', 'robots', info.indexable ? 'index, follow' : 'noindex, follow'],
    ['property', 'og:site_name', store],
    ['property', 'og:type', info.type],
    ['property', 'og:title', info.title],
    ['property', 'og:description', info.description],
    ['property', 'og:url', info.canonical],
    ['property', 'og:image', info.image],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', info.title],
    ['name', 'twitter:description', info.description],
    ['name', 'twitter:image', info.image],
  ];
}

export function structuredData(nodes) {
  return JSON.stringify({ '@context': schema, '@graph': nodes }).replaceAll('<', '\\u003c');
}
