import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-[#F8FAFC] overflow-hidden antialiased selection:bg-blue-100 selection:text-blue-900">
      <Outlet />
    </main>
  )
}
