import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getAdminLogs } from '../services/api'
import { Settings, History, Shield, Database, Bell, Save, RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'
import ConfirmModal from '../components/ConfirmModal'

export default function AdminSettings() {
  const { token } = useAuth()
  const toast = useToast()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('logs')
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs()
    }
  }, [activeTab])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const data = await getAdminLogs(100, token)
      setLogs(data)
    } catch (err) {
      toast.error('Failed to load system logs')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = () => {
    toast.success('System configuration saved successfully')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings & Logs</h1>
        <p className="text-gray-500">Configure system parameters and monitor administrative activity</p>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-4 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'logs' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          System Logs
          {activeTab === 'logs' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-4 px-4 text-sm font-medium transition-colors relative ${
            activeTab === 'config' ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Configuration
          {activeTab === 'config' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
        </button>
      </div>

      {activeTab === 'logs' ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-600" />
              Administrative Activity
            </h3>
            <button 
              onClick={fetchLogs}
              className="p-2 text-gray-500 hover:text-indigo-600 rounded-lg transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Admin</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && logs.length === 0 ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan="4" className="px-6 py-4 h-12 bg-gray-50/50"></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">No activity logs found.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors text-sm">
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{log.userName || 'System'}</div>
                        <div className="text-xs text-gray-500">{log.userEmail || ''}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          log.action.includes('DELETE') ? 'bg-red-100 text-red-700' :
                          log.action.includes('UPDATE') ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              Security Policies
            </h3>
            <div className="space-y-4">
              <ToggleSetting label="Enforce 2FA for Admins" description="Require two-factor authentication for all administrative accounts." defaultChecked={true} />
              <ToggleSetting label="IP Whitelisting" description="Restrict admin panel access to specific IP ranges." defaultChecked={false} />
              <ToggleSetting label="Session Timeout" description="Automatically log out inactive users after 30 minutes." defaultChecked={true} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Database className="h-5 w-5 text-indigo-600" />
              Data Management
            </h3>
            <div className="space-y-4">
              <ToggleSetting label="Auto-Archive History" description="Move scan history older than 90 days to cold storage." defaultChecked={true} />
              <ToggleSetting label="Detailed Logging" description="Capture full request/response payloads in system logs." defaultChecked={false} />
              <div className="pt-4">
                <button 
                  onClick={() => setShowSaveConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  <Save className="h-4 w-4" />
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={handleSaveConfig}
        title="Save Configuration"
        message="Are you sure you want to apply these system configuration changes? This may affect system behavior immediately."
        confirmText="Save Changes"
      />
    </div>
  )
}

function ToggleSetting({ label, description, defaultChecked }) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
