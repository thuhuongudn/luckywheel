import React, { useState, useMemo } from 'react';
import type { SpinRecord } from '../types/admin';
import '../styles/AdminTable.css';

interface AdminTableProps {
  spins: SpinRecord[];
  onDeleteDiscount?: (spinId: string, couponCode: string) => Promise<void>;
  onActivateDiscount?: (spinId: string, couponCode: string) => Promise<void>;
}

const AdminTable: React.FC<AdminTableProps> = ({ spins, onDeleteDiscount, onActivateDiscount }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { label: 'Hoạt động', class: 'status-active' },
      inactive: { label: 'Vô hiệu', class: 'status-inactive' },
      expired: { label: 'Hết hạn', class: 'status-expired' },
      used: { label: 'Đã dùng', class: 'status-used' }
    };
    const badge = badges[status as keyof typeof badges] || { label: status, class: '' };
    return <span className={`status-badge ${badge.class}`}>{badge.label}</span>;
  };

  const handleDelete = async (spinId: string, couponCode: string) => {
    if (!onDeleteDiscount) return;

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa dòng này?\n\nMã: ${couponCode}\n\nKhách hàng sẽ có thể quay lại sau khi xóa.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(spinId);
      await onDeleteDiscount(spinId, couponCode);
      alert(`Đã xóa thành công! Khách hàng có thể quay lại.`);
    } catch (error: any) {
      alert(`Lỗi khi xóa: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleActivate = async (spinId: string, couponCode: string) => {
    if (!onActivateDiscount) return;

    const confirmed = window.confirm(
      `Kích hoạt mã giảm giá "${couponCode}" trên Haravan?`
    );

    if (!confirmed) return;

    try {
      setActivatingId(spinId);
      await onActivateDiscount(spinId, couponCode);
      alert(`Đã kích hoạt mã giảm giá "${couponCode}" thành công!`);
    } catch (error: any) {
      alert(`Lỗi khi kích hoạt: ${error.message}`);
    } finally {
      setActivatingId(null);
    }
  };

  const filteredSpins = useMemo(() => {
    return spins.filter(spin => {
      const matchesStatus = statusFilter === 'all' || spin.status === statusFilter;
      const matchesSearch =
        spin.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        spin.phone_plain?.includes(searchTerm) ||
        spin.coupon_code?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [spins, statusFilter, searchTerm]);

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h2>Danh sách mã giảm giá</h2>

        <div className="table-filters">
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, SĐT, mã..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="used">Đã sử dụng</option>
            <option value="expired">Hết hạn</option>
            <option value="inactive">Vô hiệu</option>
          </select>
        </div>
      </div>

      <div className="table-info">
        Hiển thị {filteredSpins.length} / {spins.length} mã giảm giá
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên khách hàng</th>
              <th>Số điện thoại</th>
              <th>Mã giảm giá</th>
              <th>Giá trị</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Ngày hết hạn</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredSpins.length === 0 ? (
              <tr>
                <td colSpan={9} className="no-data">Không có dữ liệu</td>
              </tr>
            ) : (
              filteredSpins.map((spin, index) => (
                <tr key={spin.id}>
                  <td>{index + 1}</td>
                  <td>{spin.customer_name}</td>
                  <td>{spin.phone_plain || spin.phone_masked || 'N/A'}</td>
                  <td className="coupon-code">{spin.coupon_code}</td>
                  <td className="prize-value">{formatCurrency(spin.prize)}</td>
                  <td>{getStatusBadge(spin.status)}</td>
                  <td>{formatDate(spin.created_at)}</td>
                  <td>{formatDate(spin.expires_at)}</td>
                  <td className="action-cell">
                    <div className="action-buttons">
                      {/* Activate button - show only if no discount_id */}
                      {!spin.discount_id && onActivateDiscount && (
                        <button
                          onClick={() => handleActivate(spin.id, spin.coupon_code)}
                          disabled={activatingId === spin.id}
                          className="btn-activate"
                          title="Kích hoạt mã giảm giá trên Haravan"
                        >
                          {activatingId === spin.id ? '⏳' : '✅'}
                        </button>
                      )}

                      {/* Delete button - show for all rows */}
                      {onDeleteDiscount && (
                        <button
                          onClick={() => handleDelete(spin.id, spin.coupon_code)}
                          disabled={deletingId === spin.id}
                          className="btn-delete"
                          title="Xóa dòng này (khách có thể quay lại)"
                        >
                          {deletingId === spin.id ? '⏳' : '🗑️'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminTable;
