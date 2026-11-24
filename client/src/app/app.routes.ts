import type { Routes } from '@angular/router';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then((module) => module.adminRoutes) },
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
    path: 'account/privacy',
    canActivate: [authGuard],
    loadComponent: () => import('./auth/account-privacy-page').then((page) => page.AccountPrivacyPage),
    title: 'Account privacy | Apaar Garage',
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
    path: 'track-order/:orderNumber/invoice',
    loadComponent: () => import('./orders/order-invoice').then((page) => page.OrderInvoice),
    title: 'Order invoice | Apaar Garage',
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
  {
    path: 'contact',
    loadComponent: () => import('./ui/help-page').then((page) => page.HelpPage),
    data: { contactOnly: true },
    title: 'Contact and complaints | Apaar Garage',
  },
  {
    path: 'seller-information',
    loadComponent: () => import('./store-footer/seller-information-page').then((page) => page.SellerInformationPage),
    title: 'Seller information | Apaar Garage',
  },
  {
    path: 'newsletter/unsubscribe',
    loadComponent: () => import('./ui/newsletter-unsubscribe-page').then((page) => page.NewsletterUnsubscribePage),
    title: 'Newsletter unsubscribe | Apaar Garage',
  },
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
