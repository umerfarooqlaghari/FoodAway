export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  order: '/order',
  explore: '/explore',
  shop: '/shop',
  legal: '/legal',
  privacy: '/privacy',
  cookies: '/cookies',
  terms: '/terms',
  contact: '/contact',
  dsa: '/dsa',
  doNotSell: '/do-not-sell',
  foodWaste: '/food-waste',
  status: '/status',
  card: '/card',
  dashboard: '/dashboard',
  dashboardStores: '/dashboard/stores',
  dashboardOrders: '/dashboard/orders',
  dashboardReviews: '/dashboard/reviews',
  dashboardChats: '/dashboard/chats',
  dashboardStaff: '/dashboard/staff',
  dashboardUsers: '/dashboard/users',
  dashboardAppReviews: '/dashboard/app-reviews',
};

const TAB_TO_PATH = {
  dashboard: ROUTES.dashboard,
  stores: ROUTES.dashboardStores,
  orders: ROUTES.dashboardOrders,
  reviews: ROUTES.dashboardReviews,
  chats: ROUTES.dashboardChats,
  staff: ROUTES.dashboardStaff,
  superadmin: ROUTES.dashboardUsers,
  appreviews: ROUTES.dashboardAppReviews,
};

export function dashboardPathForTab(tab) {
  return TAB_TO_PATH[tab] || ROUTES.dashboard;
}

export function activeTabFromPath(pathname) {
  if (pathname.startsWith('/dashboard/stores')) return 'stores';
  if (pathname.startsWith('/dashboard/orders')) return 'orders';
  if (pathname.startsWith('/dashboard/reviews')) return 'reviews';
  if (pathname.startsWith('/dashboard/chats')) return 'chats';
  if (pathname.startsWith('/dashboard/staff')) return 'staff';
  if (pathname.startsWith('/dashboard/users')) return 'superadmin';
  if (pathname.startsWith('/dashboard/app-reviews')) return 'appreviews';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  return null;
}
