import React from 'react'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

/* ── Generic Atomic Skeleton Block ── */
export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      style={style}
      className={`skeleton-shimmer rounded-xl ${className}`}
    />
  )
}

/* ── Course Chapter Card Skeleton (MyCourses / CourseEditor) ── */
export function CourseCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 w-full animate-fade-in">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 flex-1">
            <Skeleton className="size-14 rounded-2xl shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-6 w-3/4 max-w-sm rounded-lg" />
              <Skeleton className="h-4 w-1/2 max-w-xs rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-3 self-end md:self-center shrink-0">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Class Schedule Card Skeleton (ClassReservation / InstructorScheduleManager) ── */
export function ScheduleCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full animate-fade-in">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-6 w-5/6 rounded-lg" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Dashboard Skeleton ── */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 w-full p-3 sm:p-6 lg:p-8 animate-fade-in">
      {/* Hero Banner Skeleton */}
      <Skeleton className="h-44 sm:h-52 w-full rounded-3xl" />

      {/* Stats Row Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <Skeleton className="size-12 rounded-2xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-48 w-full rounded-3xl" />
          <Skeleton className="h-48 w-full rounded-3xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-36 rounded-xl" />
          <Skeleton className="h-80 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  )
}

/* ── Profile Page Skeleton ── */
export function ProfileSkeleton() {
  return (
    <div className="space-y-8 w-full p-3 sm:p-6 lg:p-8 animate-fade-in">
      {/* Hero Header */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        <Skeleton className="size-28 sm:size-32 rounded-3xl shrink-0" />
        <div className="space-y-3 flex-1 text-center sm:text-left w-full">
          <Skeleton className="h-8 w-48 rounded-xl mx-auto sm:mx-0" />
          <Skeleton className="h-4 w-32 rounded-md mx-auto sm:mx-0" />
          <Skeleton className="h-4 w-64 rounded-md mx-auto sm:mx-0" />
        </div>
      </div>

      {/* Form & Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <Skeleton className="h-7 w-40 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-12 w-32 rounded-xl float-right" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-3xl" />
          <Skeleton className="h-44 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  )
}
