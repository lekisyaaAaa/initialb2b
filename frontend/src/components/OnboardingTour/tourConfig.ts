type Step = {
  element?: string;
  intro: string;
  title?: string;
};

const tourSteps: Step[] = [
  {
    element: 'nav',
    title: 'Navigation',
    intro: 'Navigate between Dashboard, Admin console, and other sections using this menu.',
  },
  {
    element: '#dashboard-card',
    title: 'Dashboard',
    intro: 'View real-time sensor data, system status, and key metrics at a glance.',
  },
  {
    element: '#admin-access-btn',
    title: 'Admin Access',
    intro: 'Access the admin panel to review sensors, adjust thresholds, and manage system controls.',
  },
  {
    title: 'Getting Started',
    intro: 'Welcome to BeanToBin! This environmental monitoring system helps you track sensors, tune alerting, and monitor your data in real-time.',
  },
];

export default tourSteps;
