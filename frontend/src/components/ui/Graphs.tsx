import React from 'react';
import ChartContainer from '../charts/ChartContainer';
import TemperatureChart from '../charts/TemperatureChart';
import HumidityChart from '../charts/HumidityChart';
import MoistureChart from '../charts/MoistureChart';

import { SensorData } from '../../types';

const Graphs: React.FC<{ data: SensorData[] }> = ({ data }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <ChartContainer data={data} title="Temperature" />
      <ChartContainer data={data} title="Humidity" />
      <ChartContainer data={data} title="Moisture" />
    </div>
  );
};

export default Graphs;
