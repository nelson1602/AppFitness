import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Header } from './Header'

export const AppShell = () => (
  <div className="flex min-h-screen bg-background">
    <Sidebar />

    <div className="flex flex-col flex-1 min-w-0">
      <Header />

      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <Outlet />
      </main>
    </div>

    <BottomNav />
  </div>
)
