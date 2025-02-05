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
}, {
    timestamps: true,
});

export default User;
