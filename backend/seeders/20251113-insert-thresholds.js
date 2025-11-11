"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert(
      "settings",
      [
        {
          key: "thresholds",
          value: JSON.stringify({
            temperature: { min: 20, max: 30 },
            moisture: { min: 60, max: 80 },
            ph: { min: 6.5, max: 7.5 },
            ec: { min: 1.5, max: 3.0 },
            nitrogen: { min: 800, max: 1500 },
            phosphorus: { min: 400, max: 800 },
            potassium: { min: 1000, max: 2000 },
            waterLevel: { min: 20, max: 40 },
            floatSensor: { safe: 1, unsafe: 0 }
          }),
          createdAt: now,
          updatedAt: now
        }
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("settings", { key: "thresholds" }, {});
  }
};
