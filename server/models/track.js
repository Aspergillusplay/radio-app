import { DataTypes } from 'sequelize';
import sequelize from '../db.js';
import Artist from './artist.js';

const Track = sequelize.define('Track', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    path: {
        type: DataTypes.STRING, // путь к аудиофайлу
        allowNull: false,
    },
    order: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    likes: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    artistId: {
        type: DataTypes.INTEGER,
        references: {
            model: Artist,
            key: 'id',
        },
    },
}, {
    timestamps: true,
});

// Связь с группой исполнителей
Track.belongsTo(Artist, { foreignKey: 'artistId' });
Artist.hasMany(Track, { foreignKey: 'artistId' });

export default Track;
