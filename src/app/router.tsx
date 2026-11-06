import { createBrowserRouter, Navigate } from 'react-router';
import { DEFAULT_LOCALE } from '@/i18n/locales';
import { FirstSceneRoute } from '@/routes/FirstSceneRoute';
import { LocaleLayout } from '@/routes/LocaleLayout';
import { NotFoundRoute } from '@/routes/NotFoundRoute';
import { RouteError } from '@/routes/RouteError';
import { SceneRoute } from '@/routes/SceneRoute';

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Navigate to={`/${DEFAULT_LOCALE}`} replace /> },
      {
        path: ':locale',
        element: <LocaleLayout />,
        children: [
          { index: true, element: <FirstSceneRoute /> },
          { path: 'scenes/:slug', element: <SceneRoute /> },
          { path: '*', element: <NotFoundRoute /> },
        ],
      },
    ],
  },
]);
