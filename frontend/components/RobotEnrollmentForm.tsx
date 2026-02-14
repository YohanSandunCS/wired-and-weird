'use client'

import { useState } from 'react'
import useAppStore from '@/store/appStore'

export default function RobotEnrollmentForm() {
  const [robotId, setRobotId] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { addRobot } = useAppStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    // Validate robotId is required
    if (!robotId.trim()) {
      setError('Robot ID is required')
      setIsSubmitting(false)
      return
    }

    try {
      console.log('Attempting to add robot:', robotId.trim(), name.trim() || undefined)
      const success = addRobot(robotId.trim(), name.trim() || undefined)
      console.log('Add robot result:', success)
      
      if (success) {
        // Reset form on success
        setRobotId('')
        setName('')
        console.log('Robot added successfully, form reset')
      } else {
        setError('Robot ID already exists')
      }
    } catch (error) {
      console.error('Error adding robot:', error)
      setError('Failed to add robot. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="robotId" className="block text-sm font-medium text-gray-700 mb-1">
          Robot ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="robotId"
          value={robotId}
          onChange={(e) => setRobotId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., robot-01"
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="robotName" className="block text-sm font-medium text-gray-700 mb-1">
          Friendly Name (Optional)
        </label>
        <input
          type="text"
          id="robotName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Main Bot"
          disabled={isSubmitting}
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !robotId.trim()}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Adding...' : 'Add Robot'}
      </button>
    </form>
  )
}