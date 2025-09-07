import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-coffee-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3">
              <div className="p-2 rounded-md bg-primary-600 text-white">
                <Leaf className="w-5 h-5" />
              </div>
              <span className="text-lg font-semibold text-espresso-900 dark:text-white">BeanToBin</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-sm text-espresso-600 hover:text-primary-600">Dashboard</Link>
            <Link to="/contact" className="text-sm text-espresso-600 hover:text-primary-600">Contact</Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
