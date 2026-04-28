"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface PersonEvaluationStatus {
  nrp: string
  nama?: string
  hasSubmitted: boolean
  isInProgress: boolean
  isSubmittedButIncomplete: boolean
  evaluatedCount: number
  evaluatedBy: string[]
  missingEvaluators: string[]
  criteriaScores: Record<number, boolean>
  isComplete: boolean
}

interface GroupCompletionStatus {
  groupId: string
  idkuliah: number
  totalMembers: number
  submittedCount: number
  allSubmitted: boolean
  memberStatus: PersonEvaluationStatus[]
  summaryByPerson: Record<
    string,
    {
      submitted: boolean
      evaluatedByCount: number
      isComplete: boolean
    }
  >
}

interface DashboardData {
  groups: GroupCompletionStatus[]
  courseMap: Record<number, string>
}

export default function EvaluationDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/evaluation-status")
      .then((res) => res.json())
      .then((data) => {
        setData(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error("Error fetching evaluation status:", error)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="p-8 text-center">Loading evaluation data...</div>
  }

  if (!data) {
    return <div className="p-8 text-center text-red-500">Failed to load data</div>
  }

  const completedGroups = data.groups.filter((g) => g.allSubmitted && g.memberStatus.every(m => m.isComplete))
  const incompleteGroups = data.groups.filter((g) => !g.allSubmitted || g.memberStatus.some(m => !m.isComplete))

  // Calculate overall statistics
  const totalMembers = data.groups.reduce((sum, g) => sum + g.totalMembers, 0)
  const totalCompleted = data.groups.reduce((sum, g) => {
    return sum + g.memberStatus.filter((m) => m.isComplete).length
  }, 0)
  const totalSubmittedButIncomplete = data.groups.reduce((sum, g) => {
    return sum + g.memberStatus.filter((m) => m.isSubmittedButIncomplete).length
  }, 0)
  const totalInProgress = data.groups.reduce((sum, g) => {
    return sum + g.memberStatus.filter((m) => m.isInProgress).length
  }, 0)
  const totalNotStarted = totalMembers - totalCompleted - totalSubmittedButIncomplete - totalInProgress

  return (
    <div className="space-y-8">
      {/* Stats Section */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
            <div className="text-4xl font-bold text-blue-700 mb-2">
              {data.groups.length}
            </div>
            <div className="text-sm font-medium text-blue-600">Total Groups</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
            <div className="text-4xl font-bold text-green-700 mb-2">
              {totalCompleted}
            </div>
            <div className="text-sm font-medium text-green-600">Completed ✓</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
            <div className="text-4xl font-bold text-orange-700 mb-2">
              {totalSubmittedButIncomplete}
            </div>
            <div className="text-sm font-medium text-orange-600">Incomplete ⚠</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-6 rounded-xl border border-cyan-200">
            <div className="text-4xl font-bold text-cyan-700 mb-2">
              {totalInProgress}
            </div>
            <div className="text-sm font-medium text-cyan-600">In Progress ◐</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
            <div className="text-4xl font-bold text-red-700 mb-2">
              {totalNotStarted}
            </div>
            <div className="text-sm font-medium text-red-600">Not Started ✗</div>
          </div>
        </div>
      </div>

      {/* Completed Groups */}
      {completedGroups.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-4 text-green-800 flex items-center gap-2">
            <span className="text-2xl">✓</span> Completed ({completedGroups.length})
          </h3>
          <div className="space-y-3">
            {completedGroups.map((group) => (
              <div
                key={`${group.groupId}-${group.idkuliah}`}
                className="bg-gradient-to-r from-green-50 to-green-100 p-5 rounded-xl border-l-4 border-green-500 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-green-900 text-lg">
                      {group.groupId}
                    </div>
                    <div className="text-sm text-green-700 mt-1">
                      {data.courseMap[group.idkuliah] || "Unknown Course"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {group.totalMembers}/{group.totalMembers}
                    </div>
                    <div className="text-xs text-green-600 font-medium">members completed</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Incomplete/Pending Groups */}
      {incompleteGroups.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-4 text-orange-800 flex items-center gap-2">
            <span className="text-2xl">⚠</span> Pending ({incompleteGroups.length})
          </h3>
          <div className="space-y-4">
            {incompleteGroups.map((group) => {
              const groupKey = `${group.groupId}-${group.idkuliah}`
              return (
              <div
                key={groupKey}
                className="bg-white border-2 border-orange-200 rounded-xl overflow-hidden hover:shadow-lg transition"
              >
                <button
                  onClick={() => {
                    setExpandedGroup(expandedGroup === groupKey ? null : groupKey)
                  }}
                  className="w-full bg-gradient-to-r from-orange-50 to-yellow-50 p-6 hover:from-orange-100 hover:to-yellow-100 transition text-left"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-orange-900 text-lg">
                        {group.groupId}
                      </div>
                      <div className="text-sm text-orange-700 mt-1">
                        {data.courseMap[group.idkuliah] || "Unknown Course"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600">
                        {group.submittedCount}/{group.totalMembers}
                      </div>
                      <div className="text-xs text-orange-600 font-medium">members submitted</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {expandedGroup === groupKey ? "▲" : "▼"} Click to expand
                      </div>
                    </div>
                  </div>
                </button>

                {expandedGroup === groupKey && (
                  <div className="bg-gray-50 p-6 space-y-4 border-t-2 border-orange-200">
                    {group.memberStatus.map((member) => (
                      <div
                        key={member.nrp}
                        className={`p-5 rounded-xl border-l-4 ${
                          member.isComplete
                            ? "bg-green-50 border-green-500"
                            : member.isSubmittedButIncomplete
                            ? "bg-orange-50 border-orange-500"
                            : member.isInProgress
                            ? "bg-blue-50 border-blue-500"
                            : "bg-red-50 border-red-500"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="font-bold text-lg text-gray-800">
                              {member.nama && member.nama !== member.nrp
                                ? `${member.nama} (${member.nrp})`
                                : member.nrp}
                            </div>
                            <div className="mt-2 flex gap-2 flex-wrap">
                              {member.isComplete && (
                                <span className="inline-block px-3 py-1 bg-green-200 text-green-800 rounded-full text-xs font-semibold">✓ Completed</span>
                              )}
                              {member.isSubmittedButIncomplete && (
                                <span className="inline-block px-3 py-1 bg-orange-200 text-orange-800 rounded-full text-xs font-semibold">⚠ Submitted but incomplete</span>
                              )}
                              {member.isInProgress && (
                                <span className="inline-block px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-xs font-semibold">◐ In Progress</span>
                              )}
                              {!member.hasSubmitted && !member.isInProgress && (
                                <span className="inline-block px-3 py-1 bg-red-200 text-red-800 rounded-full text-xs font-semibold">✗ Not started</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-6 bg-gray-100 px-4 py-2 rounded-lg">
                            <div className="text-2xl font-bold text-gray-700">
                              {member.evaluatedCount}/{group.totalMembers - 1}
                            </div>
                            <div className="text-xs text-gray-600 font-medium">Evaluated</div>
                          </div>
                        </div>

                        {/* Evaluation Summary Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          {member.hasSubmitted && (
                            <div className="p-3 bg-green-50 border border-green-300 rounded-lg">
                              <div className="text-xs font-semibold text-green-900 mb-1">✓ Submitted</div>
                              <div className="text-sm text-green-700">Form submitted</div>
                            </div>
                          )}
                          {member.isInProgress && !member.hasSubmitted && (
                            <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg">
                              <div className="text-xs font-semibold text-blue-900 mb-1">◐ In Progress</div>
                              <div className="text-sm text-blue-700">Started but not submitted</div>
                            </div>
                          )}
                          {!member.hasSubmitted && !member.isInProgress && (
                            <div className="p-3 bg-red-50 border border-red-300 rounded-lg">
                              <div className="text-xs font-semibold text-red-900 mb-1">✗ Not Started</div>
                              <div className="text-sm text-red-700">No evaluation begun</div>
                            </div>
                          )}
                          <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg">
                            <div className="text-xs font-semibold text-blue-900 mb-1">📊 Progress</div>
                            <div className="text-sm text-blue-700">Evaluated {member.evaluatedCount} of {group.totalMembers - 1} members</div>
                          </div>
                        </div>

                        {/* People this member hasn't evaluated */}
                        {(member.isSubmittedButIncomplete || member.isInProgress) && (
                          (() => {
                            const notEvaluatedBy = group.memberStatus
                              .filter(other => other.nrp !== member.nrp && !other.evaluatedBy.includes(member.nrp))
                              .map(other => ({
                                nrp: other.nrp,
                                nama: other.nama
                              }))
                            
                            return notEvaluatedBy.length > 0 ? (
                              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                                <div className="font-bold text-red-900 mb-3 flex items-center gap-2">
                                  <span>❌ {member.nama || member.nrp} hasn't evaluated {notEvaluatedBy.length} person(s)</span>
                                </div>
                                <div className="text-red-800 text-sm space-y-2">
                                  <div className="text-xs font-semibold text-red-700 uppercase">Still needs to evaluate:</div>
                                  <div className="space-y-2">
                                    {notEvaluatedBy.map((target) => (
                                      <div key={target.nrp} className="flex items-center gap-2 p-2 bg-white rounded border border-red-200">
                                        <span className="text-red-600">→</span>
                                        <span className="text-red-700 font-medium">
                                          {target.nama && target.nama !== target.nrp
                                            ? `${target.nama} (${target.nrp})`
                                            : target.nrp}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : null
                          })()
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
            })}
          </div>
        </section>
      )}

      {data.groups.length === 0 && (
        <div className="text-center p-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <div className="text-gray-500 text-lg">📊 No groups found</div>
          <div className="text-gray-400 text-sm mt-2">There are no groups with evaluation data yet</div>
        </div>
      )}
    </div>
  )
}
