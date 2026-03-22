'use client';

import Link from 'next/link';

interface PaginationProps {
  basePath: string;
  currentOffset: number;
  limit: number;
  total: number;
}

export default function Pagination({ basePath, currentOffset, limit, total }: PaginationProps) {
  const currentPage = Math.floor(currentOffset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasNext = currentOffset + limit < total;
  const hasPrev = currentOffset > 0;

  const separator = basePath.includes('?') ? '&' : '?';

  return (
    <div className="flex items-center justify-between py-4">
      <div className="text-sm text-gray-400">
        Showing {currentOffset + 1}–{Math.min(currentOffset + limit, total)} of {total.toLocaleString()}
      </div>
      <div className="flex gap-2">
        {hasPrev && (
          <Link
            href={`${basePath}${separator}offset=${currentOffset - limit}`}
            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700"
          >
            Previous
          </Link>
        )}
        <span className="px-3 py-1 text-sm text-gray-400">
          Page {currentPage} of {totalPages}
        </span>
        {hasNext && (
          <Link
            href={`${basePath}${separator}offset=${currentOffset + limit}`}
            className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm hover:bg-gray-700"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
