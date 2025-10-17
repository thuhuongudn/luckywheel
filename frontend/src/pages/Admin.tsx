import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../services/adminApi';
import AdminStats from '../components/AdminStats';
import AdminTable from '../components/AdminTable';
import PrizeDistributionComponent from '../components/PrizeDistribution';
import type { SpinRecord, SpinStatistics, PrizeDistribution } from '../types/admin';
import '../styles/Admin.css';

const Admin: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [spins, setSpins] = useState<SpinRecord[]>([]);
  const [stats, setStats] = useState<SpinStatistics | null>(null);
  const [distributions, setDistributions] = useState<PrizeDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchData();
  }, [isAuthenticated, navigate]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [spinsData, statsData, distData] = await Promise.all([
        adminApi.getSpins(),
        adminApi.getStatistics(),
        adminApi.getPrizeDistribution()
      ]);

      setSpins(spinsData);
      setStats(statsData);
      setDistributions(distData);

      // Auto-refresh Haravan status for active spins on page load
      autoRefreshHaravanStatus();
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const autoRefreshHaravanStatus = async () => {
    try {
      console.log('🔄 Auto-refreshing Haravan status for active spins...');

      const result = await adminApi.refreshHaravanStatus();

      if (result.data?.updated > 0) {
        console.log(`✅ Updated ${result.data.updated} active spins`);
        // Refresh data silently to show updated status
        const spinsData = await adminApi.getSpins();
        setSpins(spinsData);
      }
    } catch (err) {
      console.error('⚠️ Auto-refresh Haravan status failed:', err);
      // Don't show error to user, this is a background operation
    }
  };

  const handleDeleteDiscount = async (spinId: string, _couponCode: string) => {
    try {
      await adminApi.deleteHaravanDiscount(spinId);

      // Refresh data to show updated state
      const spinsData = await adminApi.getSpins();
      setSpins(spinsData);
    } catch (err: any) {
      throw new Error(err.message || 'Không thể xóa mã giảm giá');
    }
  };

  const handleActivateDiscount = async (spinId: string, _couponCode: string) => {
    try {
      await adminApi.createHaravanDiscount(spinId);

      // Refresh data to show updated state
      const spinsData = await adminApi.getSpins();
      setSpins(spinsData);
    } catch (err: any) {
      throw new Error(err.message || 'Không thể kích hoạt mã giảm giá');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRefresh = () => {
    fetchData();
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error">
        <p>{error}</p>
        <button onClick={handleRefresh}>Thử lại</button>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div className="header-content">
          <h1>Lucky Wheel Admin Dashboard</h1>
          <div className="header-actions">
            <button onClick={() => navigate('/')} className="home-button-admin">
              🎡 Đến trang quay số
            </button>
            <button onClick={handleRefresh} className="refresh-button">
              ⚡ Làm mới
            </button>
            <button onClick={handleLogout} className="logout-button">
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {stats && <AdminStats stats={stats} />}

        {distributions.length > 0 && (
          <PrizeDistributionComponent distributions={distributions} />
        )}

        <AdminTable
          spins={spins}
          onDeleteDiscount={handleDeleteDiscount}
          onActivateDiscount={handleActivateDiscount}
        />
      </div>
    </div>
  );
};

export default Admin;
