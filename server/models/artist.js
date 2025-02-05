import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

const Artist = sequelize.define('Artist', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    image: {
        type: DataTypes.STRING,  // путь к изображению
        allowNull: false,
    },
}, {
    timestamps: false,
});

export default Artist;
