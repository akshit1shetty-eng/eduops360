import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import { ThemeProvider } from './hooks/useTheme'
import eduopsFaviconUrl from './assets/eduops.png'
import AppPreloader from './components/AppPreloader.tsx'
import Layout from './components/Layout.tsx'
import ProgramSelectorPage from './pages/ProgramSelectorPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import LearnerProfilePage from './pages/LearnerProfilePage.tsx'
import LearnersPage from './pages/LearnersPage.tsx'
import LiveSessionsPage from './pages/LiveSessionsPage.tsx'
import ImmersionPage from './pages/ImmersionPage.tsx'
import DissertationPage from './pages/DissertationPage.tsx'
import AcademicPerformancePage from './pages/AcademicPerformancePage.tsx'
import ErrorPage from './pages/ErrorPage.tsx'

import LexLayout from './pages/lex/LexLayout.tsx'
import LexDashboardHome from './pages/lex/LexDashboardHome.tsx'
import LexLearnerDashboard from './pages/lex/LexLearnerDashboard.tsx'
import LexBudgetDashboard from './pages/lex/LexBudgetDashboard.tsx'
import LexProgramBudgetDetail from './pages/lex/LexProgramBudgetDetail.tsx'
import LexCohortBudgetDetail from './pages/lex/LexCohortBudgetDetail.tsx'

// Auth
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AdminPanel from './pages/admin/AdminPanel'

const ensureFavicon = (href: string) => {
  const head = document.head
  if (!head) return

  const existing = head.querySelector<HTMLLinkElement>('link[rel="icon"]')
  const link = existing ?? document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/png'
  link.href = href
  if (!existing) head.appendChild(link)
}

const router = createBrowserRouter([
  // ── Public routes ──────────────────────────────────────────────────────────

  // Root: redirect to login (ProtectedRoute will bounce back to /lex/home if already authed)
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },

  // App login
  {
    path: '/login',
    element: <LoginPage />,
  },

  // Admin login - redirect to unified login
  {
    path: '/admin/login',
    element: <Navigate to="/login" replace />,
  },

  // ── Protected: Admin ───────────────────────────────────────────────────────
  {
    element: <ProtectedRoute requireAdmin />,
    children: [
      { path: '/admin', element: <AdminPanel /> },
    ],
  },

  // ── Protected: Program Selector ────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/programs',
        element: <ProgramSelectorPage />,
        errorElement: <ErrorPage />,
      },
    ],
  },

  // ── Protected: Lex (Overall Dashboard) ─────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/lex',
        element: <LexLayout />,
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <Navigate to="home" replace /> },
          { path: 'home', element: <LexDashboardHome /> },
          { path: 'learners', element: <LexLearnerDashboard /> },
          { path: 'budget', element: <LexBudgetDashboard /> },
          { path: 'budget/:programId', element: <LexProgramBudgetDetail /> },
          { path: 'budget/:programId/:cohortId', element: <LexCohortBudgetDetail /> },
          { path: '*', element: <Navigate to="home" replace /> },
        ],
      },
    ],
  },

  // ── Protected: Generic Program Route (/programId) ──────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/:programId',
        element: <Layout />,
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'learners', element: <LearnersPage /> },
          { path: 'live-sessions', element: <LiveSessionsPage /> },
          { path: 'immersion', element: <ImmersionPage /> },
          { path: 'dissertation', element: <DissertationPage /> },
          { path: 'academic-performance', element: <AcademicPerformancePage /> },
          { path: 'learner/:userId', element: <LearnerProfilePage /> },
          { path: '*', element: <Navigate to="dashboard" replace /> },
        ],
      },
    ],
  },

  // Catch-all 404
  { path: '*', element: <ErrorPage /> },
])

ensureFavicon(eduopsFaviconUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <AppPreloader />
        <RouterProvider router={router} />
      </ThemeProvider>
    </AuthProvider>
  </StrictMode>,
)
