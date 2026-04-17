import { useStaff } from '@/features/staff/store';
import { TESTIDS } from '@/testids';
import type { Staff } from '@/types';
import React, { useState } from 'react';
import StaffForm from './StaffForm';

/**
 * 職員マスタ管理パネル
 *
 * 職員一覧の表示、新規登録、編集、削除機能を提供
 */
const StaffPanel: React.FC = () => {
  const { data: staffList, loading, error, reload } = useStaff();
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const handleCreateSuccess = (_newStaff: Staff) => {

    setShowCreateForm(false);
    reload();
  };

  const handleEditSuccess = (_updatedStaff: Staff) => {

    setShowEditForm(false);
    setSelectedStaff(null);
    reload();
  };

  const handleEditClick = (staff: Staff) => {
    setSelectedStaff(staff);
    setShowEditForm(true);
  };

  const handleCloseForm = () => {
    setShowCreateForm(false);
    setShowEditForm(false);
    setSelectedStaff(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-gray-600">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          職員情報を読み込んでいます...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          <h3 className="font-medium text-red-900 mb-2">エラーが発生しました</h3>
          <p className="text-sm">{error instanceof Error ? error.message : '職員情報の取得に失敗しました'}</p>
          <button
            onClick={reload}
            className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 border border-red-300 rounded text-sm text-red-800 transition"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid={TESTIDS['staff-panel-root']}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">職員マスタ</h1>
          <p className="text-gray-600 mt-1">職員の情報を管理します</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        >
          新規職員登録
        </button>
      </div>

      {/* 職員作成フォーム */}
      {showCreateForm && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">新規職員登録</h2>
          <StaffForm
            mode="create"
            onSuccess={handleCreateSuccess}
            onClose={handleCloseForm}
          />
        </div>
      )}

      {/* 職員編集フォーム */}
      {showEditForm && selectedStaff && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">職員情報編集</h2>
          <StaffForm
            staff={selectedStaff}
            mode="update"
            onSuccess={handleEditSuccess}
            onClose={handleCloseForm}
          />
        </div>
      )}

      {/* 職員一覧 */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">職員一覧</h2>
            <div className="text-sm text-gray-500">
              {staffList.length}人の職員が登録されています
            </div>
          </div>
        </div>

        {staffList.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 text-lg mb-2">👥</div>
            <div className="text-gray-600 text-lg font-medium">職員が登録されていません</div>
            <div className="text-gray-500 text-sm mt-1">「新規職員登録」ボタンから職員を登録してください</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    職員ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    氏名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    役職
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    連絡先
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    資格
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.staffId || `#${staff.id}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {staff.name}
                        </div>
                        {staff.furigana && (
                          <div className="text-sm text-gray-500">{staff.furigana}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {staff.role || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {staff.email && (
                          <div className="text-sm text-gray-900">{staff.email}</div>
                        )}
                        {staff.phone && (
                          <div className="text-sm text-gray-500">{staff.phone}</div>
                        )}
                        {!staff.email && !staff.phone && '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {staff.certifications && staff.certifications.length > 0 ? (
                        <div className="space-y-1">
                          {staff.certifications.slice(0, 2).map((cert, index) => (
                            <span
                              key={index}
                              className="inline-block bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full"
                            >
                              {cert}
                            </span>
                          ))}
                          {staff.certifications.length > 2 && (
                            <span className="text-xs text-gray-500">
                              +{staff.certifications.length - 2}件
                            </span>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                          staff.active !== false
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {staff.active !== false ? '在籍中' : '退職'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditClick(staff)}
                        className="text-emerald-600 hover:text-emerald-900 transition-colors"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffPanel;
