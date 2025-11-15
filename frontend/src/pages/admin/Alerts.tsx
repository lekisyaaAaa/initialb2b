import React from 'react';
import { Navigate } from 'react-router-dom';

export default function Alerts(): React.ReactElement {
  return <Navigate to="/admin?tab=monitoring" replace />;
}
