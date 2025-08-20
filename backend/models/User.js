const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for username lookups
userSchema.index({ username: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this.save();
};

// Static method to create default users
userSchema.statics.createDefaultUsers = async function() {
  try {
    // Check if admin user exists
    const adminExists = await this.findOne({ username: 'admin' });
    if (!adminExists) {
      const admin = new this({
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Default admin user created');
    }

    // Check if regular user exists
    const userExists = await this.findOne({ username: 'user' });
    if (!userExists) {
      const user = new this({
        username: 'user',
        password: 'user123',
        role: 'user'
      });
      await user.save();
      console.log('✅ Default user created');
    }
  } catch (error) {
    console.error('❌ Error creating default users:', error);
  }
};

module.exports = mongoose.model('User', userSchema);
