import { DataTypes } from 'sequelize';
import sequelize from '../db.js';
import User from './user.js';

const Wish = sequelize.define('Wish', {
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
}, {
    timestamps: true,
});

Wish.belongsTo(User);
User.hasMany(Wish);

export default Wish;
