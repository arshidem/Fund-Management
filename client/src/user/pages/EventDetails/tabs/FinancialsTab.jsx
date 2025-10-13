import React, { useState, useEffect } from "react";
import { useContributionService } from "../../../../services/contributionService";
import { FaRupeeSign, FaChartLine, FaMoneyBillWave, FaReceipt, FaDownload, FaFilter } from "react-icons/fa";

const FinancialsTab = ({ event, isEventCreator, formatCurrency, formatDate }) => {
  const { fetchContributionStatistics } = useContributionService();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isEventCreator) {
      loadStatistics();
    }
  }, [event._id, isEventCreator]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await fetchContributionStatistics(event._id);
      setStats(data.statistics);
    } catch (error) {
      console.error("Error loading statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash': return '💵';
      case 'online': return '🌐';
      case 'bank_transfer': return '🏦';
      case 'upi': return '📱';
      case 'card': return '💳';
      default: return '💰';
    }
  };

  if (!isEventCreator) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
        <FaMoneyBillWave className="text-5xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Financial Details</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Only event organizers can view financial details
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <FaRupeeSign className="text-green-600 dark:text-green-400 text-lg" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Collected</p>
              <p className="text-gray-900 dark:text-white font-bold text-xl">
                {formatCurrency(event.totalCollected)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <FaReceipt className="text-red-600 dark:text-red-400 text-lg" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Total Expenses</p>
              <p className="text-gray-900 dark:text-white font-bold text-xl">
                {formatCurrency(event.totalExpenses)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <FaChartLine className="text-blue-600 dark:text-blue-400 text-lg" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Current Balance</p>
              <p className={`font-bold text-xl ${
                event.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(event.balance)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <FaMoneyBillWave className="text-purple-600 dark:text-purple-400 text-lg" />
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Payment Progress</p>
              <p className="text-gray-900 dark:text-white font-bold text-xl">
                {event.paymentProgress?.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Payment Status Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FaFilter className="text-blue-500 dark:text-blue-400" />
            Payment Status Breakdown
          </h3>
          <div className="space-y-4">
            {stats?.byStatus && Object.entries(stats.byStatus).map(([status, data]) => (
              <div key={status} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    status === 'completed' ? 'bg-green-500' :
                    status === 'pending' ? 'bg-yellow-500' :
                    status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                  }`}></div>
                  <span className="text-gray-900 dark:text-white font-medium capitalize">
                    {status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-gray-900 dark:text-white font-semibold">
                    {formatCurrency(data.totalAmount || 0)}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {data.count || 0} payments
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FaMoneyBillWave className="text-green-500 dark:text-green-400" />
            Payment Methods
          </h3>
          <div className="space-y-4">
            {stats?.byPaymentMethod && Object.entries(stats.byPaymentMethod).map(([method, data]) => (
              <div key={method} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getPaymentMethodIcon(method)}</span>
                  <span className="text-gray-900 dark:text-white font-medium capitalize">
                    {method.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-gray-900 dark:text-white font-semibold">
                    {formatCurrency(data.totalAmount || 0)}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {data.count || 0} payments
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Budget Progress */}
      {event.estimatedBudget && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Budget Progress</h3>
            <span className="text-gray-600 dark:text-gray-400 text-sm">
              {event.budgetUtilization?.toFixed(1)}% utilized
            </span>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Estimated Budget</span>
              <span className="text-gray-900 dark:text-white font-semibold">
                {formatCurrency(event.estimatedBudget)}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-4 rounded-full overflow-hidden">
              <div 
                className="bg-purple-500 h-full transition-all duration-500"
                style={{ width: `${event.budgetUtilization || 0}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total Expenses</span>
              <span className="text-red-600 dark:text-red-400 font-semibold">
                {formatCurrency(event.totalExpenses)}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Remaining Budget</span>
              <span className="text-green-600 dark:text-green-400 font-semibold">
                {formatCurrency(event.estimatedBudget - event.totalExpenses)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Export Financial Data</h3>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors duration-200">
            <FaDownload className="text-sm" />
            Export Contributions CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors duration-200">
            <FaDownload className="text-sm" />
            Export Payment Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors duration-200">
            <FaDownload className="text-sm" />
            Export Financial Summary
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinancialsTab;