interface PaymentResultPageProps {
  success: boolean
  seatId: number | null
  onRetry: () => void
}

export function PaymentResultPage({ success, seatId, onRetry }: PaymentResultPageProps) {
  if (success) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-green-400">예매 완료!</h2>
        <p className="text-gray-400">
          <span className="text-yellow-400 font-bold">{seatId}번</span> 좌석이 확정되었습니다
        </p>
        <button
          onClick={onRetry}
          className="mt-4 px-6 py-2 border border-gray-700 rounded hover:border-gray-500 text-sm transition-colors"
        >
          다시 예매하기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="text-6xl">❌</div>
      <h2 className="text-2xl font-bold text-red-400">결제 실패 또는 시간 초과</h2>
      <p className="text-gray-500 text-sm">좌석 잠금이 해제되었습니다</p>
      <button
        onClick={onRetry}
        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
      >
        다시 시도하기
      </button>
    </div>
  )
}
