// server/models/user.js
import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const User = sequelize.define('User', {
    firebaseId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    role: {
        type: DataTypes.ENUM('USER', 'ADMIN'),
        defaultValue: 'USER',
        allowNull: false,
    },
    login: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
    },
    profileImage: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    timestamps: true,
});

export default User;