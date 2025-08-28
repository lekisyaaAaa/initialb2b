import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const HomeAssistant: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-coffee-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h1 className="text-2xl font-semibold text-espresso-900 dark:text-white mb-2">Home Assistant Integration</h1>
        <p className="text-sm text-espresso-600 dark:text-gray-300 mb-4">
          This page is the entry point for Home Assistant integration and IoT configuration. Use the controls here to
          configure the system that connects your sensors to Home Assistant.
        </p>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium text-espresso-900 dark:text-white">Status</h2>
            <p className="text-sm text-espresso-600 dark:text-gray-300">{
              isAuthenticated ? `${user?.username} (Admin)` : 'Not authenticated'
            }</p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-espresso-900 dark:text-white">Quick actions</h2>
            <div className="mt-2 flex space-x-2">
              <a
                target="_blank"
                rel="noreferrer"
                href="http://homeassistant.local:8123"
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                Open Home Assistant
              </a>

              <Link to="/admin/dashboard" className="px-4 py-2 bg-coffee-100 text-espresso-700 rounded-md hover:bg-coffee-200 transition-colors">
                Back to Dashboard
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-espresso-900 dark:text-white">Notes</h3>
            <ul className="list-disc ml-5 text-sm text-espresso-600 dark:text-gray-300">
              <li>Ensure Home Assistant is reachable on your network (example: http://homeassistant.local:8123).</li>
              <li>Adjust the URL above if your Home Assistant instance uses a different host or port.</li>
              <li>For advanced integration, configure webhooks or MQTT on Home Assistant and update the backend accordingly.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeAssistant;
