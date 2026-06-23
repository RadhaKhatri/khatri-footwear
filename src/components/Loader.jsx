import React from 'react'
export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="text-4xl mb-4">👟</div>
        <div className="w-8 h-8 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <div className="text-sm text-gray-500">{text}</div>
      </div>
    </div>
  )
}
