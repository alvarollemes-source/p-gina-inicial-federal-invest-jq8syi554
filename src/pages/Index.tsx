import { RefreshCcw } from 'lucide-react'

const Index = () => {
  return (
    <div
      className="w-full px-6 flex flex-col items-center justify-center animate-fade-in-up"
      style={{ animationDuration: '800ms', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' }}
    >
      <div className="flex flex-col items-center w-full max-w-2xl bg-white px-8 py-16 sm:px-16 sm:py-20 rounded-[2rem] shadow-elevation border border-slate-100 text-center">
        <div className="flex items-center justify-center w-20 h-20 bg-blue-50 rounded-2xl mb-10 text-blue-600 shadow-sm border border-blue-100/30">
          <RefreshCcw className="w-8 h-8 animate-[spin_4s_linear_infinite]" strokeWidth={1.5} />
        </div>

        <h1 className="text-[1.35rem] sm:text-3xl md:text-4xl font-normal text-slate-500 tracking-tight">
          <span className="font-semibold text-slate-900">Federal Invest</span> — projeto em
          importação
        </h1>
      </div>
    </div>
  )
}

export default Index
