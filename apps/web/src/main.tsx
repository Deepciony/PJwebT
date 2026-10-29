import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ApiError } from './api';
import { Layout } from './components/Layout';
import { Login, NotFound, Register, RequireAuth } from './pages/Auth';
import BookingDetail from './pages/BookingDetail';
import Bookings from './pages/Bookings';
import Cart from './pages/Cart';
import CourtDetail from './pages/CourtDetail';
import Courts from './pages/Courts';
import { EquipmentDetail, EquipmentList } from './pages/Equipment';
import About from './pages/About';
import Board from './pages/Board';
import Home from './pages/Home';
import Inbox from './pages/Inbox';
import Profile from './pages/Profile';
import './styles.css';

// staff-only screens are split out so members never download them
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Payments = lazy(() => import('./pages/admin/Payments'));
const Checkin = lazy(() => import('./pages/admin/Checkin'));
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings'));
const Catalog = lazy(() => import('./pages/admin/Catalog'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const Users = lazy(() => import('./pages/admin/Users'));
const Emails = lazy(() => import('./pages/admin/Emails'));
const System = lazy(() => import('./pages/admin/System'));
const ApiDocs = lazy(() => import('./pages/admin/ApiDocs'));
const Terminal = lazy(() => import('./pages/admin/Terminal'));
const UserDetail = lazy(() => import('./pages/admin/Users').then((m) => ({ default: m.UserDetail })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx answers are final; only retry network/server hiccups
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'book', element: <Board /> },
      { path: 'about', element: <About /> },
      { path: 'courts', element: <Courts /> },
      { path: 'courts/:id', element: <CourtDetail /> },
      { path: 'equipment', element: <EquipmentList /> },
      { path: 'equipment/:id', element: <EquipmentDetail /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'cart', element: <Cart /> },
          { path: 'bookings', element: <Bookings /> },
          { path: 'bookings/:id', element: <BookingDetail /> },
          { path: 'profile', element: <Profile /> },
          { path: 'inbox', element: <Inbox /> },
        ],
      },
      {
        path: 'admin',
        element: <RequireAuth admin />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { index: true, element: <Dashboard /> },
              { path: 'payments', element: <Payments /> },
              { path: 'checkin', element: <Checkin /> },
              { path: 'bookings', element: <AdminBookings /> },
              { path: 'catalog', element: <Catalog /> },
              { path: 'coupons', element: <Coupons /> },
              { path: 'users', element: <Users /> },
              { path: 'users/:id', element: <UserDetail /> },
              { path: 'emails', element: <Emails /> },
              { path: 'system', element: <System /> },
              { path: 'api', element: <ApiDocs /> },
              { path: 'terminal', element: <Terminal /> },
              { path: 'about', element: <About /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
