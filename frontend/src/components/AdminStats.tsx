import React from 'react';
import type { SpinStatistics } from '../types/admin';
import '../styles/AdminStats.css';

interface AdminStatsProps {
  stats: SpinStatistics;
}

const AdminStats: React.FC<AdminStatsProps> = ({ stats }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  };

  return (
    <div className="admin-stats">
      <h2>Thống kê tổng quan</h2>

      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">Tổng số mã giảm giá</div>
            <div className="stat-value">{stats.total_spins.toLocaleString()}</div>
          </div>
        </div>

        <div className="stat-card active">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-label">Mã đang hoạt động (Active)</div>
            <div className="stat-value">{stats.active_count.toLocaleString()}</div>
          </div>
        </div>

        <div className="stat-card used">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">Mã đã sử dụng (Used)</div>
            <div className="stat-value">{stats.used_count.toLocaleString()}</div>
          </div>
        </div>

        <div className="stat-card expired">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <div className="stat-label">Mã đã hết hạn (Expired)</div>
            <div className="stat-value">{stats.expired_count.toLocaleString()}</div>
          </div>
        </div>

        <div className="stat-card value active-value">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <div className="stat-label">Giá trị mã Active</div>
            <div className="stat-value">{formatCurrency(stats.active_value)}</div>
          </div>
        </div>

        <div className="stat-card value used-value">
          <div className="stat-icon">💸</div>
          <div className="stat-content">
            <div className="stat-label">Giá trị mã đã dùng</div>
            <div className="stat-value">{formatCurrency(stats.used_value)}</div>
          </div>
        </div>

        <div className="stat-card value potential-value">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-label">Tiềm năng (Active + Used)</div>
            <div className="stat-value">{formatCurrency(stats.potential_value)}</div>
          </div>
        </div>

        <div className="stat-card value total-value">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-label">Tổng giá trị tất cả mã</div>
            <div className="stat-value">{formatCurrency(stats.total_prize_value)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats;
