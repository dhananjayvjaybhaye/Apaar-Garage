import type { Routes } from '@angular/router';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./home/home').then((page) => page.Home),
    title: 'Apaar Garage | Collector-grade diecast',
  },
  {
    path: 'catalog',
    loadComponent: () => import('./catalog/catalog').then((page) => page.Catalog),
    title: 'The Collection | Apaar Garage',
  },
  {
    path: 'product/:slug',
    loadComponent: () =>
      import('./product-detail/product-detail').then((page) => page.ProductDetail),
    title: 'Product Detail | Apaar Garage',
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/auth-page').then((page) => page.AuthPage),
    title: 'Sign in | Apaar Garage',
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/auth-page').then((page) => page.AuthPage),
    data: { register: true },
    title: 'Create an account | Apaar Garage',
  },
  {
    path: 'cart',
    loadComponent: () => import('./cart/cart-page').then((page) => page.CartPage),
    title: 'Your cart | Apaar Garage',
  },
  {
    path: 'checkout/success/:orderNumber',
    loadComponent: () => import('./orders/order-success').then((page) => page.OrderSuccess),
    title: 'Order received | Apaar Garage',
  },
  {
    path: 'checkout',
    loadComponent: () => import('./orders/checkout-page').then((page) => page.CheckoutPage),
    title: 'Checkout | Apaar Garage',
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./orders/order-history').then((page) => page.OrderHistory),
    title: 'Order history | Apaar Garage',
  },
  {
    path: 'track-order/:orderNumber',
    loadComponent: () => import('./orders/order-tracking').then((page) => page.OrderTracking),
    title: 'Track order | Apaar Garage',
  },
  {
    path: 'wishlist',
    loadComponent: () => import('./shop/wishlist-page').then((page) => page.WishlistPage),
    title: 'Wishlist | Apaar Garage',
  },
  {
    path: 'faq',
    loadComponent: () => import('./ui/help-page').then((page) => page.HelpPage),
    title: 'FAQ and support | Apaar Garage',
  },
  {
    path: 'about',
    loadComponent: () => import('./store-footer/policy-page').then((page) => page.PolicyPage),
    data: { policy: 'about' },
    title: 'About | Apaar Garage',
  },
  { path: 'contact', redirectTo: '/faq#contact', pathMatch: 'full' },
  ...(['privacy', 'shipping', 'returns', 'terms'] as const).map((policy) => ({
    path: 'policies/' + policy,
    loadComponent: () => import('./store-footer/policy-page').then((page) => page.PolicyPage),
    data: { policy },
    title: 'Store Policies | Apaar Garage',
  })),
  {
    path: '**',
    loadComponent: () => import('./ui/not-found').then((page) => page.NotFound),
    title: 'Page not found | Apaar Garage',
  },
];
