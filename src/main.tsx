import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import { ThemeProvider } from './hooks/useTheme'
import eduopsFaviconUrl from './assets/eduops.png'
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
  // Program Selector (landing page)
  {
    path: '/',
    element: <ProgramSelectorPage />,
    errorElement: <ErrorPage />
  },

  // Generic Program Route
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

  // MBA — enabled
  // Handled by generic program route /:programId above

  // Catch-all root 404
  { path: '*', element: <ErrorPage /> }
])

ensureFavicon(eduopsFaviconUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
)
