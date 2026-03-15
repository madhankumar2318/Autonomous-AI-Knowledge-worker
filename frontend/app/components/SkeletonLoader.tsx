"use client";

interface SkeletonProps {
    className?: string;
}

export function SkeletonCard() {
    return (
        <div className="card space-y-3">
            <div className="skeleton h-6 w-3/4"></div>
            <div className="skeleton h-4 w-full"></div>
            <div className="skeleton h-4 w-5/6"></div>
            <div className="skeleton h-32 w-full rounded-lg"></div>
        </div>
    );
}

export function SkeletonText({ className = "" }: SkeletonProps) {
    return <div className={`skeleton h-4 ${className}`}></div>;
}

export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
}

export default function SkeletonLoader() {
    return (
        <div className="space-y-4 animate-fade-in">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
        </div>
    );
}
