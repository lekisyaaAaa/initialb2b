import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Phone, 
  Mail, 
  User,
  MapPin,
  Building,
  ArrowLeft,
  Users,
  Clock,
  Shield
} from 'lucide-react';
import DarkModeToggle from '../components/DarkModeToggle';

interface ContactInfo {
  name: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  address: string;
  availability: string;
}

const ContactPage: React.FC = () => {
  const [copied, setCopied] = useState<null | { index: number; type: 'phone' | 'email' }>(null);
  const contacts: ContactInfo[] = [
    {
      name: "Aranda, Trishia Nicolein D.",
      position: "Documentation Specialist",
      department: "Information Technology Department",
      phone: "+63 917 123 4567",
      email: "trishianicolein.aranda@letran.edu.ph",
      address: "Colegio de San Juan de Letran",
      availability: "Monday to Friday, 8:00 AM - 5:00 PM"
    },
    {
      name: "De Silva, Justine Erickson M.",
      position: "IoT Specialist",
      department: "Information Technology Department",
      phone: "+63 928 987 6543",
      email: "justineerickson.desilva@letran.edu.ph",
      address: "Colegio de San Juan de Letran",
      availability: "Monday to Saturday, 9:00 AM - 6:00 PM"
    },
    {
      name: "Dubouzet, Ranzheskha Lequixia L.",
      position: "Full Stack Developer",
      department: "Information Technology Department",
      phone: "+63 939 555 7890",
      email: "ranzheskhalequixia.dubouzet@letran.edu.ph",
      address: "Colegio de San Juan de Letran",
      availability: "Monday to Friday, 7:00 AM - 4:00 PM"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-coffee-50 to-coffee-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <Link 
              to="/" 
              className="inline-flex items-center text-coffee-600 dark:text-coffee-400 hover:text-coffee-800 dark:hover:text-coffee-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Link>
            <DarkModeToggle />
          </div>

          <div className="contact-hero mx-auto max-w-5xl text-center relative">
            <div className="contact-hero-deco" aria-hidden="true">
                <svg width="520" height="420" viewBox="0 0 520 420" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
                  <defs>
                    <linearGradient id="g1" x1="0" x2="1">
                      <stop offset="0%" stopColor="#8E44AD" stopOpacity="0.12"/>
                      <stop offset="100%" stopColor="#00BFA6" stopOpacity="0.06"/>
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="520" height="420" rx="24" fill="url(#g1)" />
                  <circle cx="420" cy="80" r="120" fill="#00BFA6" fillOpacity="0.06" />
                  <circle cx="80" cy="320" r="100" fill="#8E44AD" fillOpacity="0.04" />
                </svg>
              </div>
            <div className="contact-hero-inner relative z-10">
              <h1 className="text-4xl font-bold text-coffee-900 dark:text-white mb-2">Contact Information</h1>
              <p className="text-coffee-700 dark:text-gray-300 text-lg max-w-2xl mx-auto mb-4">
              Get in touch with our environmental monitoring team. Our experts are here to assist you 
              with any questions about environmental data, sensor systems, or monitoring services.
            </p>
            {/* hero actions removed as requested */}
            </div>
          </div>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-6">
          {contacts.map((contact, index) => {
            const accents = ['purple', 'blue', 'green'];
            const accent = accents[index % accents.length];
            return (
              <div 
                  key={index}
                  className="contact-card overflow-hidden min-h-[320px] flex flex-col"
                  data-accent={accent}
                >
                  <div className="card-accent" />
                {/* Card Header */}
                <div className="p-6">
                <div className="flex items-center mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-coffee-500 to-primary-500 rounded-full flex items-center justify-center mr-4 shadow-md">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-coffee-900 dark:text-white">{contact.name}</h3>
                    <p className="text-coffee-500 dark:text-coffee-300 text-sm">{contact.position}</p>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="contact-card-body p-6 space-y-4 flex-1">
                {/* Department */}
                <div className="grid grid-cols-12 gap-x-3 items-start">
                  <div className="col-span-1 mt-1">
                    <Building className="w-5 h-5 text-coffee-600 dark:text-coffee-400" />
                  </div>
                  <div className="col-span-11">
                    <p className="text-sm text-coffee-500 dark:text-coffee-400 font-medium">Department</p>
                    <p className="text-coffee-800 dark:text-gray-200">{contact.department}</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="grid grid-cols-12 gap-x-3 items-start">
                  <div className="col-span-1 mt-1">
                    <Phone className="w-5 h-5 text-coffee-600 dark:text-coffee-400" />
                  </div>
                  <div className="col-span-11">
                    <p className="text-sm text-coffee-500 dark:text-coffee-400 font-medium">Phone</p>
                    <a 
                      href={`tel:${contact.phone}`}
                      className="text-coffee-800 dark:text-gray-200 hover:text-coffee-600 dark:hover:text-coffee-400 transition-colors"
                    >
                      {contact.phone}
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="grid grid-cols-12 gap-x-3 items-start">
                  <div className="col-span-1 mt-1">
                    <Mail className="w-5 h-5 text-coffee-600 dark:text-coffee-400" />
                  </div>
                  <div className="col-span-11">
                    <p className="text-sm text-coffee-500 dark:text-coffee-400 font-medium">Email</p>
                    <a 
                      href={`mailto:${contact.email}`}
                      className="text-coffee-800 dark:text-gray-200 hover:text-coffee-600 dark:hover:text-coffee-400 transition-colors break-all"
                    >
                      {contact.email}
                    </a>
                  </div>
                </div>

                {/* Address */}
                <div className="grid grid-cols-12 gap-x-3 items-start">
                  <div className="col-span-1 mt-1">
                    <MapPin className="w-5 h-5 text-coffee-600 dark:text-coffee-400" />
                  </div>
                  <div className="col-span-11">
                    <p className="text-sm text-coffee-500 dark:text-coffee-400 font-medium">Address</p>
                    <p className="text-coffee-800 dark:text-gray-200">{contact.address}</p>
                  </div>
                </div>

                {/* Availability */}
                <div className="grid grid-cols-12 gap-x-3 items-start">
                  <div className="col-span-1 mt-1">
                    <Clock className="w-5 h-5 text-coffee-600 dark:text-coffee-400" />
                  </div>
                  <div className="col-span-11">
                    <p className="text-sm text-coffee-500 dark:text-coffee-400 font-medium">Availability</p>
                    <p className="text-coffee-800 dark:text-gray-200">{contact.availability}</p>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="contact-card-footer bg-coffee-50 dark:bg-gray-700 px-6 py-4">
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(contact.phone);
                        setCopied({ index, type: 'phone' });
                        setTimeout(() => setCopied(null), 2000);
                      } catch (e) {
                        /* clipboard not supported */
                      }
                    }}
                    className="contact-cta flex-1 bg-coffee-600 text-white justify-center"
                  >
                    {copied && copied.index === index && copied.type === 'phone' ? 'Copied!' : 'Copy Phone'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(contact.email);
                        setCopied({ index, type: 'email' });
                        setTimeout(() => setCopied(null), 2000);
                      } catch (e) {
                        /* clipboard not supported */
                      }
                    }}
                    className="contact-cta flex-1 bg-primary-600 text-white justify-center"
                  >
                    {copied && copied.index === index && copied.type === 'email' ? 'Copied!' : 'Copy Email'}
                  </button>
                </div>
              </div>
              </div>
            );
          })}
        </div>

        {/* Additional Information */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-coffee-100 dark:bg-coffee-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-coffee-600 dark:text-coffee-300" />
            </div>
            <h2 className="text-2xl font-bold text-coffee-900 dark:text-white mb-2">Environmental Monitoring Team</h2>
            <p className="text-coffee-700 dark:text-gray-300">
              Our dedicated team of professionals is committed to providing accurate environmental data 
              and maintaining the highest standards in monitoring services.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-coffee-100 dark:bg-coffee-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-coffee-600 dark:text-coffee-300" />
              </div>
              <h3 className="font-semibold text-coffee-900 dark:text-white mb-2">24/7 Monitoring</h3>
              <p className="text-coffee-600 dark:text-gray-400 text-sm">
                Continuous environmental monitoring and real-time data collection
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-coffee-100 dark:bg-coffee-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-coffee-600 dark:text-coffee-300" />
              </div>
              <h3 className="font-semibold text-coffee-900 dark:text-white mb-2">Expert Support</h3>
              <p className="text-coffee-600 dark:text-gray-400 text-sm">
                Professional guidance from experienced environmental specialists
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-coffee-100 dark:bg-coffee-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-coffee-600 dark:text-coffee-300" />
              </div>
              <h3 className="font-semibold text-coffee-900 dark:text-white mb-2">Quick Response</h3>
              <p className="text-coffee-600 dark:text-gray-400 text-sm">
                Rapid response to environmental alerts and emergency situations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
