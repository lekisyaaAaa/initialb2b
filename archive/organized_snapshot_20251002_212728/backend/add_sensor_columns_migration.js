const { Sequelize } = require('sequelize');
const sequelize = require('../services/database_pg');

async function addNewSensorColumns() {
  try {
    console.log('Adding new sensor columns to sensordata table...');

    // Add pH column
    await sequelize.getQueryInterface().addColumn('sensordata', 'ph', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    // Add EC column
    await sequelize.getQueryInterface().addColumn('sensordata', 'ec', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    // Add nitrogen column
    await sequelize.getQueryInterface().addColumn('sensordata', 'nitrogen', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    // Add phosphorus column
    await sequelize.getQueryInterface().addColumn('sensordata', 'phosphorus', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    // Add potassium column
    await sequelize.getQueryInterface().addColumn('sensordata', 'potassium', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });

    // Add waterLevel column
    await sequelize.getQueryInterface().addColumn('sensordata', 'waterLevel', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    console.log('Successfully added new sensor columns to sensordata table');
  } catch (error) {
    console.error('Error adding new sensor columns:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  addNewSensorColumns();
}

module.exports = addNewSensorColumns;
