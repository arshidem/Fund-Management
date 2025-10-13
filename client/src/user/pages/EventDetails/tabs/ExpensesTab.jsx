import React, { useState, useEffect } from "react";
import { useContributionService } from "../../../../services/contributionService";
import { FaMoneyBillWave, FaSearch, FaFilter, FaDownload, FaCheck, FaTimes, FaReceipt } from "react-icons/fa";

const ContributionsTab = ({ event, user, isEventCreator, formatCurrency, formatDate }) => {
  const { fetchEventContributions } = useContributionService();
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  useEffect(() => {
    if (isEventCreator) {
      loadContributions();
    }
  }, [event._id, isEventCreator]);

  const loadContributions = async () => {
    try {
      setLoading(true);
      const data = await fetchEventContributions(event._id, {
        status: statusFilter !== "all" ? statusFilter : undefined,
        paymentMethod: methodFilter !== "all" ? methodFilter : undefined,
      });
      setContributions(data.contributions || []);
    } catch (error) {
      console.error("Error loading contributions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      case 'pending': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20';
      case 'failed': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'refunded': return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'cash': return '💵';
      case 'online': return '🌐';
      case 'bank_transfer': return '🏦';
      case 'upi': return '📱';
      case 'card': return '💳';
      default: return '💰';
    }
  };

  const filteredContributions = contributions.filter(contribution => {
    const matchesSearch = 
      contribution.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contribution.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contribution.transactionId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const totalContributions = contributions
    .filter(c => c.status === 'completed')
    .reduce((sum, c) => sum + c.amount, 0);

  const pendingContributions = contributions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);

  if (!isEventCreator) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
        <FaMoneyBillWave className="text-5xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Contribution Details</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Only event organizers can view contribution details
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-300 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contribution Summary */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Collected</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalContributions)}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Pending Verification</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatCurrency(pendingContributions)}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Contributions</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {contributions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Header with Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">All Contributions</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {filteredContributions.length} contributions found
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Search */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search contributions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-blue-500 w-full sm:w-64"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
            </select>

            {/* Export Button */}
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors duration-200">
              <FaDownload className="text-sm" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Contributions List */}
      <div className="space-y-4">
        {filteredContributions.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
            <FaMoneyBillWave className="text-5xl text-gray-400 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Contributions Found</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchTerm || statusFilter !== 'all' || methodFilter !== 'all' 
                ? "Try adjusting your filters" 
                : "No contributions have been made yet"
              }
            </p>
          </div>
        ) : (
          filteredContributions.map((contribution) => (
            <div
              key={contribution._id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-2xl">
                    {getMethodIcon(contribution.paymentMethod)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {contribution.user.name}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contribution.status)}`}>
                        {contribution.status}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{contribution.user.email}</span>
                      <span>•</span>
                      <span className="capitalize">{contribution.paymentMethod.replace('_', ' ')}</span>
                      <span>•</span>
                      <span>{formatDate(contribution.paymentDate)}</span>
                      {contribution.transactionId && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-xs">Ref: {contribution.transactionId}</span>
                        </>
                      )}
                    </div>

                    {contribution.notes && (
                      <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                        {contribution.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(contribution.amount)}
                    </p>
                    {contribution.refundAmount > 0 && (
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        Refunded: {formatCurrency(contribution.refundAmount)}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {contribution.status === 'pending' && (
                      <>
                        <button className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors duration-200">
                          <FaCheck />
                        </button>
                        <button className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200">
                          <FaTimes />
                        </button>
                      </>
                    )}
                    {contribution.receiptUrl && (
                      <button className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200">
                        <FaReceipt />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment Method Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Payment Methods Distribution</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['cash', 'online', 'bank_transfer', 'upi'].map((method) => {
            const methodContributions = contributions.filter(c => c.paymentMethod === method && c.status === 'completed');
            const total = methodContributions.reduce((sum, c) => sum + c.amount, 0);
            const count = methodContributions.length;

            return (
              <div key={method} className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl mb-2">{getMethodIcon(method)}</div>
                <p className="text-gray-900 dark:text-white font-semibold capitalize">
                  {method.replace('_', ' ')}
                </p>
                <p className="text-green-600 dark:text-green-400 font-bold">
                  {formatCurrency(total)}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {count} payments
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ContributionsTab;