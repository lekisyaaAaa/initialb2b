import React, { useState, useRef, useEffect } from 'react';
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
  const contacts: ContactInfo[] = [
    {
      name: "Aranda, Trishia Nicolein D.",
      position: "Documentation Specialist",
      department: "Research & Documentation Unit",
      phone: "+63 917 123 4567",
      email: "trishianicolein.aranda@letran.edu.ph",
      address: "Colegio de San Juan de Letran",
      availability: "Monday to Friday, 8:00 AM - 5:00 PM"
    },
    {
      name: "De Silva, Justine Erickson M.",
      position: "IoT Hardware Engineer",
      department: "IoT Hardware & Sensor Technology Division",
      phone: "+63 928 987 6543",
      email: "justineerickson.desilva@letran.edu.ph",
      address: "Colegio de San Juan de Letran",
      availability: "Monday to Friday, 8:00 AM - 5:00 PM"
    },
    {
      name: "Dubouzet, Ranzheskha Lequixia L.",
      position: "Full Stack Web Developer",
      department: "Information & Communications Technology (ICT) Department",
      phone: "+63 939 555 7890",
      email: "ranzheskhalequixia.dubouzet@letran.edu.ph",
      address: "Colegio de San Juan de Letran",
      availability: "Monday to Friday, 8:00 AM - 5:00 PM"
    }
  ];

  // Toast state for copy feedback
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const toastClearTimer = useRef<number | null>(null);
  const [toastActive, setToastActive] = useState(false);

  const showToast = (msg: string, ms = 2500) => {
    setToast(msg);
    setToastActive(true);
    // clear any existing timers
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    if (toastClearTimer.current) window.clearTimeout(toastClearTimer.current);

    // After ms, start hide animation then clear toast after animation duration
    toastTimer.current = window.setTimeout(() => {
      setToastActive(false);
      // allow animation (300ms) to finish before removing from DOM
      toastClearTimer.current = window.setTimeout(() => setToast(null), 300) as unknown as number;
    }, ms) as unknown as number;
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (toastClearTimer.current) window.clearTimeout(toastClearTimer.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-coffee-50 to-coffee-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center text-coffee-600 hover:text-coffee-800 transition-colors mb-4 dark:text-gray-300 dark:hover:text-white"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold text-coffee-900 mb-4 dark:text-white">Contact Information</h1>
            <p className="text-coffee-700 text-lg max-w-2xl mx-auto dark:text-gray-300">
              Get in touch with our environmental monitoring team. Our experts are here to assist you 
              with any questions about environmental data, sensor systems, or monitoring services.
            </p>
          </div>
        </div>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {contacts.map((contact, index) => (
            <div 
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden"
            >
        <div className="bg-gradient-to-r from-coffee-600 to-coffee-700 text-white p-6 dark:from-gray-800 dark:to-gray-700">
                <div className="flex items-center mb-3">
          <div className="w-12 h-12 bg-coffee-500 rounded-full flex items-center justify-center mr-4 dark:bg-gray-700">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
        <h3 className="text-xl font-bold text-coffee-900 dark:text-white">{contact.name}</h3>
                    <p className="text-coffee-100 text-sm">{contact.position}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-start">
                  <Building className="w-5 h-5 text-coffee-600 mr-3 mt-1 flex-shrink-0 dark:text-gray-300" />
                  <div>
                    <p className="text-sm text-coffee-500 font-medium">Department</p>
                    <p className="text-coffee-800 dark:text-gray-200">{contact.department}</p>
                  </div>
                </div>

                <div className="flex items-start">
          <Phone className="w-5 h-5 text-coffee-600 mr-3 mt-1 flex-shrink-0 dark:text-gray-300" />
                  <div>
                    <p className="text-sm text-coffee-500 font-medium">Phone</p>
                    <a 
                      href={`tel:${contact.phone}`}
            className="text-coffee-800 hover:text-coffee-600 transition-colors dark:text-gray-200 dark:hover:text-white"
                    >
                      {contact.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
          <Mail className="w-5 h-5 text-coffee-600 mr-3 mt-1 flex-shrink-0 dark:text-gray-300" />
                  <div>
                    <p className="text-sm text-coffee-500 font-medium">Email</p>
                    <a
                      href={`mailto:${contact.email}?subject=${encodeURIComponent('Inquiry about Environmental Monitoring')}&body=${encodeURIComponent(`Hello ${contact.name},%0D%0A%0D%0AI would like to ask about...`)}`}
                      className="text-coffee-800 hover:text-coffee-600 transition-colors break-all dark:text-gray-200 dark:hover:text-white"
                      aria-label={`Email ${contact.name}`}
                      onClick={(e) => {
                        // Use in-page mailto navigation to avoid opening webmail in a new tab
                        e.preventDefault();
                        const mailto = `mailto:${contact.email}?subject=${encodeURIComponent('Inquiry about Environmental Monitoring')}&body=${encodeURIComponent(`Hello ${contact.name},\r\n\r\nI would like to ask about...`)}`;
                        window.location.href = mailto;
                      }}
                    >
                      {contact.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-coffee-600 mr-3 mt-1 flex-shrink-0 dark:text-gray-300" />
                  <div>
                    <p className="text-sm text-coffee-500 font-medium">Address</p>
                    <p className="text-coffee-800 dark:text-gray-200">{contact.address}</p>
                  </div>
                </div>

                <div className="flex items-start">
      <Clock className="w-5 h-5 text-coffee-600 mr-3 mt-1 flex-shrink-0 dark:text-gray-300" />
                  <div>
                    <p className="text-sm text-coffee-500 font-medium">Availability</p>
        <p className="text-coffee-800 dark:text-gray-200">{contact.availability}</p>
                  </div>
                </div>
              </div>

      <div className="bg-coffee-50 dark:bg-gray-900 px-6 py-4">
                <div className="flex space-x-3">
                  {/* Replace direct call/email actions with copy actions to avoid triggering external apps */}
      <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (navigator?.clipboard?.writeText) {
                          await navigator.clipboard.writeText(contact.phone);
                        } else {
                          const ta = document.createElement('textarea');
                          ta.value = contact.phone;
                          ta.style.position = 'fixed';
                          document.body.appendChild(ta);
                          ta.focus();
                          ta.select();
                          document.execCommand('copy');
                          document.body.removeChild(ta);
                        }
        showToast('Phone copied to clipboard');
                      } catch (err) {
                        console.error('Failed to copy phone:', err);
                      }
                    }}
                    aria-label={`Copy phone number for ${contact.name}`}
                    className="flex-1 bg-coffee-600 text-white text-center py-2 px-4 rounded-lg hover:bg-coffee-700 transition-colors dark:bg-coffee-700 dark:hover:bg-coffee-800"
                  >
                    Copy Phone
                  </button>

      <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (navigator?.clipboard?.writeText) {
                          await navigator.clipboard.writeText(contact.email);
                        } else {
                          const ta = document.createElement('textarea');
                          ta.value = contact.email;
                          ta.style.position = 'fixed';
                          document.body.appendChild(ta);
                          ta.focus();
                          ta.select();
                          document.execCommand('copy');
                          document.body.removeChild(ta);
                        }
        showToast('Email copied to clipboard');
                      } catch (err) {
                        console.error('Failed to copy email:', err);
                      }
                    }}
                    aria-label={`Copy email address for ${contact.name}`}
                    className="flex-1 bg-coffee-200 text-coffee-800 text-center py-2 px-4 rounded-lg hover:bg-coffee-300 transition-colors dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Copy Email
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

    <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-coffee-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-gray-700">
              <Users className="w-8 h-8 text-coffee-600 dark:text-gray-200" />
            </div>
    <h2 className="text-2xl font-bold text-coffee-900 mb-2 dark:text-white">Environmental Monitoring Team</h2>
    <p className="text-coffee-700 dark:text-gray-300">
              Our dedicated team of professionals is committed to providing accurate environmental data 
              and maintaining the highest standards in monitoring services.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">

            <div className="text-center">
              <div className="w-12 h-12 bg-coffee-100 rounded-full flex items-center justify-center mx-auto mb-3 dark:bg-gray-700">
                <Shield className="w-6 h-6 text-coffee-600 dark:text-gray-200" />
              </div>
              <h3 className="font-semibold text-coffee-900 mb-2 dark:text-white">24/7 Monitoring</h3>
              <p className="text-coffee-600 text-sm dark:text-gray-300">
                Continuous environmental monitoring and real-time data collection
              </p>
            </div>


            <div className="text-center">
              <div className="w-12 h-12 bg-coffee-100 rounded-full flex items-center justify-center mx-auto mb-3 dark:bg-gray-700">
                <Users className="w-6 h-6 text-coffee-600 dark:text-gray-200" />
              </div>
              <h3 className="font-semibold text-coffee-900 mb-2 dark:text-white">Expert Support</h3>
              <p className="text-coffee-600 text-sm dark:text-gray-300">
                Professional guidance from experienced environmental specialists
              </p>
            </div>


            <div className="text-center">
              <div className="w-12 h-12 bg-coffee-100 rounded-full flex items-center justify-center mx-auto mb-3 dark:bg-gray-700">
                <Clock className="w-6 h-6 text-coffee-600 dark:text-gray-200" />
              </div>
              <h3 className="font-semibold text-coffee-900 mb-2 dark:text-white">Quick Response</h3>
              <p className="text-coffee-600 text-sm dark:text-gray-300">
                Rapid response to environmental alerts and emergency situations
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Toast / snackbar */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
          <div className={`pointer-events-auto bg-black text-white px-4 py-2 rounded-lg shadow-lg opacity-0 transform translate-y-4 ${toastActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} transition-all duration-300`}>{toast}</div>
        </div>
      )}
    </div>
  );
};

export default ContactPage;
