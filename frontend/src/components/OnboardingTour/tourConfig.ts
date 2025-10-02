type Step = {
  element?: string;
  intro: string;
  title?: string;
};

const tourSteps: Step[] = [
  {
    element: 'nav',
    title: 'Main navigation',
    intro: 'Use the main navigation to access the Dashboard, Admin console, and other pages.',
  },
  {
    element: '#dashboard-card',
    title: 'Dashboard overview',
    intro: 'This card shows the latest sensor readings and quick stats.',
  },
  {
    element: '#admin-access-btn',
    title: 'Admin access',
    intro: 'Click here to sign in to the admin console where you can control actuators and settings.',
  },
  {
    element: '#actuator-controls',
    title: 'Actuator Controls',
    intro: 'Open the actuator panel to manually operate devices and view action logs.',
  },
];

export default tourSteps;
