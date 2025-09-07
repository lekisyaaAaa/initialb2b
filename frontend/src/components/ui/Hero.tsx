import React from 'react';

const Hero: React.FC = () => {
  return (
    <section className="bg-gradient-to-r from-primary-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 mb-6 transition-transform duration-300 ease-out transform hover:-translate-y-1">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-espresso-900 dark:text-white">Live Environmental Overview</h2>
          <p className="mt-2 text-sm text-espresso-600 dark:text-gray-300">Real-time sensors, alerts, and tips to keep your SmartBins healthy and efficient.</p>
        </div>
        <div className="mt-4 md:mt-0">
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition">Add Sensor</button>
            <button className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition">Export</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
