import React, { useState } from 'react';
import type { PrizeDistribution } from '../types/admin';
import '../styles/PrizeDistribution.css';

interface PrizeDistributionProps {
  distributions: PrizeDistribution[];
}

const PrizeDistributionComponent: React.FC<PrizeDistributionProps> = ({ distributions }) => {
  const [statusFilter, setStatusFilter] = useState<string>('total');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  };

  const getPrizeLabel = (prize: number) => {
    return formatCurrency(prize);
  };

  const getFilteredCount = (dist: PrizeDistribution) => {
    switch (statusFilter) {
      case 'active': return dist.active;
      case 'used': return dist.used;
      case 'expired': return dist.expired;
      case 'inactive': return dist.inactive;
      default: return dist.total;
    }
  };

  const getTotalCount = () => {
    return distributions.reduce((sum, dist) => sum + getFilteredCount(dist), 0);
  };

  const getPercentage = (dist: PrizeDistribution) => {
    const total = getTotalCount();
    if (total === 0) return 0;
    return (getFilteredCount(dist) / total) * 100;
  };

  return (
    <div className="prize-distribution">
      <div className="distribution-header">
        <h2>Phân bổ mã theo giá trị giải</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="total">Tất cả</option>
          <option value="active">Hoạt động</option>
          <option value="used">Đã sử dụng</option>
          <option value="expired">Hết hạn</option>
          <option value="inactive">Vô hiệu</option>
        </select>
      </div>

      <div className="distribution-grid">
        {distributions.map((dist) => {
          const count = getFilteredCount(dist);
          const percentage = getPercentage(dist);

          return (
            <div key={dist.prize} className="distribution-card">
              <div className="prize-header">
                <h3>{getPrizeLabel(dist.prize)}</h3>
                <span className="prize-count">{count} mã</span>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <div className="prize-stats">
                <div className="stat-row">
                  <span className="stat-label">Tỷ lệ:</span>
                  <span className="stat-value">{percentage.toFixed(1)}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Tổng giá trị:</span>
                  <span className="stat-value">{formatCurrency(dist.prize * count)}</span>
                </div>
              </div>

              <div className="status-breakdown">
                <div className="status-item active">
                  <span className="status-dot"></span>
                  <span>Active: {dist.active}</span>
                </div>
                <div className="status-item used">
                  <span className="status-dot"></span>
                  <span>Used: {dist.used}</span>
                </div>
                <div className="status-item expired">
                  <span className="status-dot"></span>
                  <span>Expired: {dist.expired}</span>
                </div>
                {dist.inactive > 0 && (
                  <div className="status-item inactive">
                    <span className="status-dot"></span>
                    <span>Inactive: {dist.inactive}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="distribution-summary">
        <p>Tổng số mã ({statusFilter === 'total' ? 'tất cả' : statusFilter}): <strong>{getTotalCount()}</strong></p>
      </div>
    </div>
  );
};

export default PrizeDistributionComponent;
