"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface EvaluatorStat {
  evaluator_nrp: string
  nama: string | null
  matkul: string | null
  idkuliah: number
  done_count: number
  should_do: number
}

export default function EvaluationDashboard() {
  const [stats, setStats] = useState<EvaluatorStat[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/evaluation-status")
      .then((res) => res.json())
      .then((data) => {
        setStats(data.stats)
        setLoading(false)
      })
      .catch((error) => {
        console.error("Error fetching evaluation stats:", error)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading evaluation statistics...</div>
  }

  if (!stats) {
    return <div className="p-8 text-center text-red-500">Failed to load data</div>
  }

  // Group stats by course
  const coursesMap = new Map<number, { idkuliah: number; matkul: string; evaluators: EvaluatorStat[] }>()
  stats.forEach(stat => {
    if (!coursesMap.has(stat.idkuliah)) {
      coursesMap.set(stat.idkuliah, {
        idkuliah: stat.idkuliah,
        matkul: stat.matkul || "Unknown Course",
        evaluators: []
      })
    }
    coursesMap.get(stat.idkuliah)!.evaluators.push(stat)
  })

  const courses = Array.from(coursesMap.values())

  return (
    <div className="space-y-8">
      {courses.map((course) => {
        // Calculate totals for course
        const totalDone = course.evaluators.reduce((sum, e) => sum + e.done_count, 0)
        const totalShouldDo = course.evaluators.reduce((sum, e) => sum + e.should_do, 0)
        const completionRate = totalShouldDo > 0 ? (totalDone / totalShouldDo) * 100 : 0
        
        return (
          <div key={course.idkuliah} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{course.matkul}</h3>
                <p className="text-sm text-gray-500 mt-1">Course ID: {course.idkuliah} • {course.evaluators.length} Evaluators</p>
              </div>
              <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                <div className="text-center">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Completion</div>
                  <div className="text-lg font-bold text-blue-600">{completionRate.toFixed(1)}%</div>
                </div>
                <div className="h-8 w-px bg-gray-200"></div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Done / Total</div>
                  <div className="text-lg font-bold text-gray-800">{totalDone} / {totalShouldDo}</div>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                    <th className="p-4 pl-6">NRP</th>
                    <th className="p-4">Name</th>
                    <th className="p-4 text-center">Done</th>
                    <th className="p-4 text-center">Should Do</th>
                    <th className="p-4 pr-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {course.evaluators.map((ev) => {
                    const isComplete = ev.done_count >= ev.should_do
                    const isMissing = ev.done_count < ev.should_do
                    const percentComplete = ev.should_do > 0 ? (ev.done_count / ev.should_do) * 100 : 100
                    
                    return (
                      <tr key={ev.evaluator_nrp} className="hover:bg-gray-50 transition-colors group">
                        <td className="p-4 pl-6 font-mono text-sm text-gray-600">
                          {ev.evaluator_nrp}
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-gray-900">{ev.nama || "Unknown"}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 text-sm font-bold rounded-md ${isMissing ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-800'}`}>
                              {ev.done_count}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 text-sm font-medium rounded-md bg-gray-100 text-gray-600">
                              {ev.should_do}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          {isComplete ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-semibold">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              Complete
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-2 w-full">
                              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(percentComplete, 100)}%` }}></div>
                              </div>
                              <span className="text-xs font-semibold text-orange-600 w-16 text-right">
                                {ev.should_do - ev.done_count} missing
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
      
      {courses.length === 0 && (
        <div className="text-center p-16 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="text-gray-500 text-lg font-medium">No evaluation statistics available</div>
          <div className="text-gray-400 text-sm mt-2">There are no courses with assigned groups yet.</div>
        </div>
      )}
    </div>
  )
}
