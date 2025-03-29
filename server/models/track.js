// server/models/track.js
import { DataTypes } from 'sequelize';
import sequelize from '../db.js';
import Artist from './artist.js';

const Track = sequelize.define('Track', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    path: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    order: {
        type: DataTypes.INTEGER,
        allowNull: true, // Changed to true to allow null during reordering
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
    group: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    isDuplicate: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    timestamps: true,
});

Track.belongsTo(Artist, { foreignKey: 'artistId' });
Artist.hasMany(Track, { foreignKey: 'artistId' });

export default Track;
