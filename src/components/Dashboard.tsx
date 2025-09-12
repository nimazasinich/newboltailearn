import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Bell,
  User,
  Menu,
  X,
  TrendingUp,
  Users,
  FileText,
  Activity,
  Plus,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface DashboardProps {}

// Sample data for charts
const lineChartData = [
  { name: 'Jan', documents: 400, processed: 240 },
  { name: 'Feb', documents: 300, processed: 139 },
  { name: 'Mar', documents: 200, processed: 980 },
  { name: 'Apr', documents: 278, processed: 390 },
  { name: 'May', documents: 189, processed: 480 },
  { name: 'Jun', documents: 239, processed: 380 },
];

const pieChartData = [
  { name: 'Processed', value: 400, color: '#0ea5e9' },
  { name: 'Pending', value: 300, color: '#f59e0b' },
  { name: 'Failed', value: 100, color: '#ef4444' },
  { name: 'Archived', value: 200, color: '#10b981' },
];

const recentDocuments = [
  { id: 1, name: 'Legal Document 001.pdf', type: 'Contract', status: 'Processed', date: '2024-01-15', size: '2.4 MB' },
  { id: 2, name: 'Court Decision 045.pdf', type: 'Judgment', status: 'Processing', date: '2024-01-14', size: '1.8 MB' },
  { id: 3, name: 'Legal Brief 123.pdf', type: 'Brief', status: 'Pending', date: '2024-01-13', size: '3.1 MB' },
  { id: 4, name: 'Regulation 789.pdf', type: 'Regulation', status: 'Processed', date: '2024-01-12', size: '4.2 MB' },
  { id: 5, name: 'Case Study 456.pdf', type: 'Case', status: 'Failed', date: '2024-01-11', size: '2.9 MB' },
];

export const Dashboard: React.FC<DashboardProps> = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [showNotifications, setShowNotifications] = useState(false);

  const sidebarItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const stats = [
    { title: 'Total Documents', value: '12,543', change: '+12%', icon: FileText, color: 'persian-500' },
    { title: 'Processed Today', value: '847', change: '+8%', icon: Activity, color: 'green-500' },
    { title: 'Active Users', value: '2,341', change: '+5%', icon: Users, color: 'blue-500' },
    { title: 'Success Rate', value: '94.2%', change: '+2%', icon: TrendingUp, color: 'purple-500' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Processed': return 'bg-green-100 text-green-800';
      case 'Processing': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleLogout = () => {
    console.log('Logout clicked');
    // Implement logout logic here
  };

  const handleSearch = (query: string) => {
    console.log('Search:', query);
    // Implement search logic here
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="ltr">
      {/* Sidebar */}
      <motion.aside
        className={`bg-white shadow-lg transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-16'
        } relative z-10`}
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-persian-500 to-persian-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            {isSidebarOpen && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 font-vazir">Legal AI</h2>
                <p className="text-sm text-gray-500">Dashboard</p>
              </div>
            )}
          </div>
        </div>

        <nav className="mt-6">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-6 py-3 text-left transition-colors duration-200 ${
                  activeTab === item.id
                    ? 'bg-persian-50 text-persian-600 border-r-2 border-persian-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="w-5 h-5" />
                {isSidebarOpen && <span className="ml-3 font-medium">{item.label}</span>}
              </motion.button>
            );
          })}
        </nav>

        <div className="absolute bottom-6 left-0 right-0 px-6">
          <motion.button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="ml-3 font-medium">Logout</span>}
          </motion.button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navbar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <motion.button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </motion.button>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-persian-500 focus:border-transparent outline-none transition-all duration-200 w-80"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <motion.button
                  onClick={handleNotificationClick}
                  className="p-2 rounded-lg hover:bg-gray-100 relative transition-colors duration-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                </motion.button>

                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                  >
                    <div className="px-4 py-2 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">Notifications</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                          <p className="text-sm text-gray-900">Document processing completed</p>
                          <p className="text-xs text-gray-500 mt-1">2 minutes ago</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">John Doe</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
                <motion.div
                  className="w-10 h-10 bg-gradient-to-br from-persian-400 to-persian-600 rounded-full flex items-center justify-center cursor-pointer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <User className="w-5 h-5 text-white" />
                </motion.div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
              <p className="text-gray-600">Welcome back! Here's what's happening with your documents today.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.title}
                    className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-lg bg-${stat.color}/10`}>
                        <Icon className={`w-6 h-6 text-${stat.color}`} />
                      </div>
                      <span className="text-green-600 text-sm font-medium">{stat.change}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                    <p className="text-gray-600 text-sm">{stat.title}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Line Chart */}
              <motion.div
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Document Processing Trend</h3>
                  <button className="text-persian-600 hover:text-persian-700 text-sm font-medium">View Details</button>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="documents" 
                      stroke="#0ea5e9" 
                      strokeWidth={3}
                      dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="processed" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Pie Chart */}
              <motion.div
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Document Status Distribution</h3>
                  <button className="text-persian-600 hover:text-persian-700 text-sm font-medium">Export</button>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* Recent Documents Table */}
            <motion.div
              className="bg-white rounded-xl shadow-sm border border-gray-200"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Documents</h3>
                  <div className="flex items-center space-x-3">
                    <motion.button
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Filter className="w-4 h-4" />
                      <span>Filter</span>
                    </motion.button>
                    <motion.button
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-persian-600 text-white hover:bg-persian-700 rounded-lg transition-colors duration-200"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Document</span>
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentDocuments.map((doc, index) => (
                      <motion.tr
                        key={doc.id}
                        className="hover:bg-gray-50 transition-colors duration-200"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FileText className="w-5 h-5 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{doc.type}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.status)}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.size}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <motion.button
                              className="text-persian-600 hover:text-persian-900 p-1 rounded"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Eye className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              className="text-gray-600 hover:text-gray-900 p-1 rounded"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Edit className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              className="text-gray-600 hover:text-gray-900 p-1 rounded"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Download className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              className="text-red-600 hover:text-red-900 p-1 rounded"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
};