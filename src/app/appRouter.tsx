import { createBrowserRouter } from 'react-router-dom';
import { routes } from './router';
import { routerFutureFlags } from './routerFuture';

export const router = createBrowserRouter(routes, {
  future: routerFutureFlags,
});
