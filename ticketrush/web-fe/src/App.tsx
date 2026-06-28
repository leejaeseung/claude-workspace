import { useState } from 'react'
import { QueuePage } from './pages/QueuePage'
import { SeatSelectPage } from './pages/SeatSelectPage'
import { PaymentPage } from './pages/PaymentPage'
import { PaymentResultPage } from './pages/PaymentResultPage'

type Step = 'queue' | 'seat-select' | 'payment' | 'result'

const userId = `user-${Math.random().toString(36).slice(2, 8)}`

function App() {
  const [step, setStep] = useState<Step>('queue')
  const [selectedSeatId, setSelectedSeatId] = useState<number | null>(null)
  const [orderId, setOrderId] = useState<number | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const reset = () => {
    setStep('queue')
    setSelectedSeatId(null)
    setOrderId(null)
    setPaymentSuccess(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-2">🎫 TicketRush</h1>

      {/* 단계 표시기 */}
      <div className="flex items-center gap-2 text-xs text-gray-600 mb-12">
        {(['queue', 'seat-select', 'payment', 'result'] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className={step === s ? 'text-blue-400 font-bold' : ''}>
              {['대기열', '좌석선택', '결제', '완료'][i]}
            </span>
            {i < 3 && <span className="text-gray-800">›</span>}
          </span>
        ))}
      </div>

      {step === 'queue' && (
        <QueuePage onEntered={() => setStep('seat-select')} />
      )}

      {step === 'seat-select' && (
        <SeatSelectPage
          userId={userId}
          onSelected={(seatId, orderId) => {
            setSelectedSeatId(seatId)
            setOrderId(orderId)
            setStep('payment')
          }}
        />
      )}

      {step === 'payment' && selectedSeatId && orderId && (
        <PaymentPage
          orderId={orderId}
          seatId={selectedSeatId}
          userId={userId}
          onSuccess={(seatId) => {
            setSelectedSeatId(seatId)
            setPaymentSuccess(true)
            setStep('result')
          }}
          onTimeout={() => {
            setPaymentSuccess(false)
            setStep('result')
          }}
        />
      )}

      {step === 'result' && (
        <PaymentResultPage
          success={paymentSuccess}
          seatId={selectedSeatId}
          onRetry={reset}
        />
      )}
    </div>
  )
}

export default App
