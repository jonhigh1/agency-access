'use client';

/**
 * ClientStats Component
 *
 * Displays client statistics in a grid of 4 cards:
 * - Total Requests
 * - Active Connections
 * - Pending
 * - Expired
 */

import { FileText, Link, Clock, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui';
import type { ClientStats } from '@agency-platform/shared';

interface ClientStatsProps {
  stats: ClientStats;
}

export function ClientStats({ stats }: ClientStatsProps) {
  const statCards = [
    {
      label: 'Total Requests',
      value: stats.totalRequests,
      icon: <FileText className="h-5 w-5 text-primary" />,
      iconContainerClass: 'bg-primary/10',
    },
    {
      label: 'Active Connections',
      value: stats.activeConnections,
      icon: <Link className="h-5 w-5 text-success-ink" />,
      iconContainerClass: 'bg-teal/10',
    },
    {
      label: 'Pending',
      value: stats.pendingConnections,
      icon: <Clock className="h-5 w-5 text-warning" />,
      iconContainerClass: 'bg-warning/10',
    },
    {
      label: 'Expired',
      value: stats.expiredConnections,
      icon: <AlertCircle className="h-5 w-5 text-danger-ink" />,
      iconContainerClass: 'bg-coral/10',
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card) => (
        <Card
          key={card.label}
          className="p-6 border-black/10"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
            <div className={`p-2.5 rounded-lg ${card.iconContainerClass}`}>
              {card.icon}
            </div>
          </div>
          <p className="text-3xl font-semibold font-mono tabular-nums text-foreground">
            {card.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
